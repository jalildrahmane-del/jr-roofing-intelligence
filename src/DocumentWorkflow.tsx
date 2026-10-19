import React, { useEffect, useState } from "react";
import { api } from "./api.ts";
import type { RecordItem, User } from "./model.ts";
import { current } from "./tender.ts";
export function DocumentWorkflow({
  pid,
  records,
  user,
  refresh,
}: {
  pid: string;
  records: RecordItem[];
  user: User;
  refresh: () => Promise<void>;
}) {
  const [statuses, setStatuses] = useState<Record<string, any>>({}),
    [access, setAccess] = useState<any>({ accounts: [] }),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [prior, setPrior] = useState<RecordItem>(),
    [notice, setNotice] = useState("");
  const load = async () => {
    const [s, a] = await Promise.all([
      api("document-status/" + pid),
      api("access/" + pid),
    ]);
    setStatuses(s);
    setAccess(a);
  };
  useEffect(() => {
    if (pid) load().catch((e) => setError(e.message));
  }, [pid, records]);
  const action = async (fn: () => Promise<any>) => {
    setError("");
    setNotice("");
    setBusy(true);
    try {
      await fn();
      await refresh();
      await load();
      setNotice("Saved successfully.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const save = (kind: string, data: any) => api("records", { pid, kind, data });
  if (!pid) return <p>Select or create a project first.</p>;
  const writable =
    ["manager", "engineer", "supervisor"].includes(user.role) &&
    ["write", "admin"].includes(access.access);
  const documents = records.filter((r) => r.kind === "controlledDocument");
  const sources = records.filter(
    (r) =>
      [
        "controlledDocument",
        "roof",
        "defect",
        "photo",
        "material",
        "drawing",
        "loadcase",
        "query",
        "rfi",
        "load",
        "control",
        "holdpoint",
        "handoverItem",
        "diary",
      ].includes(r.kind) && current(records, r.kind).some((c) => c.id === r.id),
  );
  return (
    <>
      <p>
        Controlled revisions and independent human review. AI generation and
        paid integrations are disabled. Document approval does not certify
        structural safety or release work.
      </p>
      {error && (
        <p role="alert" className="error">
          {error} <button onClick={() => action(load)}>Retry</button>
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      {access.access === "admin" && user.role === "manager" && (
        <details>
          <summary>Project access</summary>
          <p>
            Only assigned accounts can access this project. Write permission
            does not override a user's professional role.
          </p>
          {access.accounts.map((a: any) => (
            <label key={a.id}>
              {a.name} · {a.role}
              <select
                aria-label={"Access for " + a.name}
                value={a.access || "none"}
                disabled={busy}
                onChange={(e) =>
                  action(() =>
                    api("access", { pid, uid: a.id, access: e.target.value }),
                  )
                }
              >
                {[
                  "none",
                  "read",
                  "write",
                  ...(a.role === "manager" ? ["admin"] : []),
                ].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </label>
          ))}
        </details>
      )}
      {writable && (
        <section>
          <h2>
            {prior ? "Revise " + prior.data.number : "New controlled document"}
          </h2>
          <form
            key={prior?.id || "new"}
            onSubmit={(e) => {
              e.preventDefault();
              const form = e.currentTarget;
              const f = new FormData(form);
              action(async () => {
                const file = f.get("file") as File;
                let attachment;
                if (file?.size) {
                  if (file.size > 4 * 1024 * 1024)
                    throw Error("File must be at most 4 MiB");
                  const bytes = new Uint8Array(await file.arrayBuffer());
                  let binary = "";
                  for (const byte of bytes) binary += String.fromCharCode(byte);
                  attachment = { name: file.name, base64: btoa(binary) };
                }
                const sourceIds = f.getAll("sourceIds");
                const claim = String(f.get("claim") || "").trim();
                await save("controlledDocument", {
                  number: f.get("number"),
                  revision: f.get("revision"),
                  title: f.get("title"),
                  category: f.get("category"),
                  content: f.get("content"),
                  limitations: f.get("limitations"),
                  suggestions: f.get("suggestions"),
                  sourceIds,
                  claims: claim
                    ? [
                        {
                          text: claim,
                          sourceId: f.get("claimSource"),
                          locator: f.get("locator"),
                        },
                      ]
                    : [],
                  previousId: prior?.id,
                  file: attachment,
                });
                setPrior(undefined);
                form.reset();
              });
            }}
          >
            <label>
              Document number
              <input
                name="number"
                required
                defaultValue={prior?.data.number}
                readOnly={!!prior}
              />
            </label>
            <label>
              Revision
              <input name="revision" required placeholder="P01" />
            </label>
            <label>
              Document title
              <input name="title" required defaultValue={prior?.data.title} />
            </label>
            <label>
              Category
              <select name="category" defaultValue={prior?.data.category}>
                {[
                  "Survey narrative",
                  "Specification",
                  "RAMS",
                  "CPP",
                  "Design",
                  "QA",
                  "O&M",
                  "Other",
                ].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </label>
            <label>
              Manual document content
              <textarea
                name="content"
                required
                defaultValue={prior?.data.content}
              />
            </label>
            <label>
              Limitations and unverified information
              <textarea
                name="limitations"
                required
                defaultValue={prior?.data.limitations}
              />
            </label>
            <label>
              Suggestions — not verified facts
              <textarea
                name="suggestions"
                defaultValue={prior?.data.suggestions}
              />
            </label>
            <label>
              Source records (select all that apply)
              <select
                multiple
                name="sourceIds"
                defaultValue={prior?.data.sourceIds || []}
              >
                {sources
                  .filter(
                    (r) => r.data.entityId !== prior?.data.entityId || !prior,
                  )
                  .map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.kind}:{" "}
                      {r.data.title || r.data.name || r.data.number || r.id} ·{" "}
                      {r.data.revision || r.id.slice(0, 8)}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Factual claim (optional)
              <textarea name="claim" />
            </label>
            <label>
              Claim source
              <select name="claimSource">
                <option value="">Select a source also selected above</option>
                {sources.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.kind}: {r.data.title || r.data.name || r.id}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Source page or evidence locator
              <input name="locator" />
            </label>
            <label>
              Optional attachment (.pdf or UTF-8 .txt, maximum 4 MiB)
              <input name="file" type="file" accept=".pdf,.txt" />
            </label>
            <p>
              Original attachments are untrusted downloads, not
              malware-certified files. A revision retains its previous
              attachment unless replaced.
            </p>
            <button disabled={busy}>Save draft revision</button>
            {prior && (
              <button type="button" onClick={() => setPrior(undefined)}>
                Cancel revision
              </button>
            )}
          </form>
        </section>
      )}
      <h2>Document register and history</h2>
      {!documents.length && <p>No controlled documents yet.</p>}
      {[...documents].reverse().map((d) => {
        const state = statuses[d.id];
        return (
          <article key={d.id}>
            <h3>
              {d.data.number} · {d.data.revision} — {d.data.title}
            </h3>
            <p>
              <strong>{state?.status || "Checking status…"}</strong> ·{" "}
              {d.createdAt} · {d.data.actor?.name}
            </p>
            <p>
              {d.data.category} · {d.data.origin}
            </p>
            <details>
              <summary>Read content and approval history</summary>
              <p style={{ whiteSpace: "pre-wrap" }}>{d.data.content}</p>
              <h4>Limitations</h4>
              <p>{d.data.limitations}</p>
              <h4>Suggestions — not verified facts</h4>
              <p>{d.data.suggestions || "None recorded"}</p>
              <h4>Source-linked claims</h4>
              {d.data.claims.map((c: any, i: number) => (
                <p key={i}>
                  {c.text} · Source {c.sourceId} · {c.locator}
                </p>
              ))}
              <p>Source record IDs: {d.data.sourceIds.join(", ") || "None"}</p>
              {records
                .filter(
                  (r) =>
                    ["documentSubmit", "documentReview"].includes(r.kind) &&
                    r.data.documentId === d.id,
                )
                .map((r) => (
                  <p key={r.id}>
                    {r.createdAt} · {r.data.actor.name} ·{" "}
                    {r.data.decision || "Submitted"} · {r.data.note} ·{" "}
                    {r.data.source}
                  </p>
                ))}
            </details>
            {d.data.fileId && (
              <a
                className="button"
                href={"/api/document-files/" + d.data.fileId}
              >
                Download original attachment
              </a>
            )}
            <a className="button" href={"/api/controlled-document-pdf/" + d.id}>
              Download review PDF
            </a>
            {writable &&
              current(records, "controlledDocument").some(
                (r) => r.id === d.id,
              ) && (
                <button
                  onClick={() => {
                    setPrior(d);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                >
                  Create next revision
                </button>
              )}
            {writable &&
              (state?.canSubmit ||
                (state?.canReview && user.role === "manager")) && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const f = new FormData(e.currentTarget);
                    action(() =>
                      save(
                        state.canSubmit ? "documentSubmit" : "documentReview",
                        {
                          documentId: d.id,
                          revision: d.data.revision,
                          versionId: d.id,
                          note: f.get("note"),
                          source: f.get("source"),
                          decision: f.get("decision"),
                          attest: f.get("attest") === "on",
                        },
                      ),
                    );
                  }}
                >
                  <label>
                    Review or submission note
                    <textarea name="note" required />
                  </label>
                  {!state.canSubmit && (
                    <>
                      <label>
                        Review evidence reference
                        <input name="source" required />
                      </label>
                      <label>
                        Decision
                        <select name="decision" aria-label="Decision">
                          {state.status === "Approved for document use" ? (
                            <option value="withdrawn">Withdraw approval</option>
                          ) : (
                            <>
                              <option value="changes-requested">
                                Request changes
                              </option>
                              <option value="approved">
                                Approve for document use
                              </option>
                            </>
                          )}
                        </select>
                      </label>
                    </>
                  )}
                  <label>
                    <input type="checkbox" name="attest" required /> I have
                    reviewed this exact revision. This is not structural
                    certification or work release.
                  </label>
                  <button disabled={busy}>
                    {state.canSubmit
                      ? "Submit for independent review"
                      : "Record independent review"}
                  </button>
                </form>
              )}
          </article>
        );
      })}
    </>
  );
}
