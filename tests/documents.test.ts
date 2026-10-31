import { reviewPayload } from "./document-review-fixture.ts";
import test from "node:test";
import assert from "node:assert/strict";
import { Store } from "../server/store.ts";
import {
  documentCommand,
  documentState,
  documentPdf,
} from "../server/documents.ts";
import { verifyIntegrity } from "../server/integrity.ts";
import type { User } from "../src/model.ts";
function setup() {
  const s = new Store(":memory:");
  const add = (name: string, role: User["role"]) => ({
    id: s.addUser(name, "fictional-password", role),
    name,
    role,
    company: "Fictional",
  });
  const a = add("author", "supervisor"),
    m = add("reviewer", "manager"),
    worker = add("worker", "worker");
  const pid = s.project(m, { name: "Fictional" }).id;
  s.setProjectAccess(m,pid,{userId:a.id,permission:"edit",reason:"Synthetic document author assignment"});
  return { s, a, m, worker, pid };
}
test("document lifecycle preserves exact source provenance, independent review, revisions and stale status", async () => {
  const { s, a, m, worker, pid } = setup();
  try {
    const source = documentCommand(s, a, pid, "source", {
      title: "Fictional specification",
      reference: "SPEC-001 Rev A",
      content: "Fictional method requires review.",
    });
    const d = {
      type: "RAMS",
      title: "Fictional RAMS",
      sources: [{ recordId: source.id, excerpt: "requires review" }],
      proposals: "Proposed sequence for competent review",
      limitations: "Unverified site conditions",
    };
    assert.throws(
      () =>
        documentCommand(s, a, pid, "draft", {
          ...d,
          sources: [{ recordId: source.id, excerpt: "invented fact" }],
        }),
      /Excerpt/,
    );
    const doc = documentCommand(s, a, pid, "draft", d);
    assert.throws(
      () =>
        documentCommand(s, a, pid, "review", {
          documentId: doc.id,
          decision: "accepted",
          ...reviewPayload(),
          attest: true,
          note: "self",
        }),
      /Forbidden/,
    );
    assert.throws(() => documentState(s, worker, pid), /Forbidden/);
    documentCommand(s, m, pid, "review", {
      documentId: doc.id,
      decision: "accepted",
          ...reviewPayload(),
      attest: true,
      note: "Sources and proposed content reviewed",
    });
    assert.match(documentState(s, m, pid).documents[0].status, /Reviewed/);
    const pdf = await documentPdf(s, m, pid, doc.id);
    assert.equal(pdf.subarray(0, 5).toString(), "%PDF-");
    const rev = documentCommand(s, a, pid, "source", {
      replaces: source.id,
      title: "Revised specification",
      reference: "SPEC-001 Rev B",
      content: "Fictional revised method requires review.",
    });
    assert.match(documentState(s, m, pid).documents[0].status, /Stale/);
    assert.throws(
      () =>
        documentCommand(s, m, pid, "review", {
          documentId: doc.id,
          decision: "accepted",
          ...reviewPayload(),
          attest: true,
          note: "old source",
        }),
      /superseded/,
    );
    const newer = documentCommand(s, a, pid, "draft", {
      ...d,
      replaces: doc.id,
      sources: [{ recordId: rev.id, excerpt: "revised method" }],
    });
    assert.equal(newer.data.version, 2);
    assert.equal(documentState(s, m, pid).documents[0].status, "Superseded");
    assert.match(documentState(s, m, pid).documents[1].status, /Draft/);
    verifyIntegrity(s.db);
  } finally {
    s.close();
  }
});
test("paid AI cannot be activated by client request and cross-project sources are denied", () => {
  const { s, a, m, pid } = setup();
  try {
    assert.throws(
      () =>
        documentCommand(s, m, pid, "generate", {
          approved: true,
          apiKey: "not-a-key",
        }),
      /disabled/,
    );
    const source = documentCommand(s, a, pid, "source", {
      title: "Source",
      reference: "S",
      content: "text",
    });
    const other = s.project(m, { name: "Other" }).id;
    s.setProjectAccess(m,other,{userId:a.id,permission:"edit",reason:"Synthetic second project author assignment"});
    assert.throws(
      () =>
        documentCommand(s, a, other, "draft", {
          type: "CPP",
          title: "Test",
          sources: [{ recordId: source.id, excerpt: "text" }],
          proposals: "Draft",
          limitations: "Gaps",
        }),
      /project source/,
    );
  } finally {
    s.close();
  }
});
test("integrity detects modified records and broken audit chain", () => {
  const { s, a, pid } = setup();
  try {
    const source = documentCommand(s, a, pid, "source", {
      title: "Source",
      reference: "S",
      content: "text",
    });
    verifyIntegrity(s.db);
    s.db.prepare("UPDATE records SET data=? WHERE id=?").run("{}", source.id);
    assert.throws(() => verifyIntegrity(s.db), /Record audit/);
    s.db.prepare("UPDATE audit SET hash='tampered' WHERE seq=1").run();
    assert.throws(() => verifyIntegrity(s.db), /Audit integrity/);
  } finally {
    s.close();
  }
});
