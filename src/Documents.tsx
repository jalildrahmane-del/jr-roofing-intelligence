import React, { useState, useEffect } from "react";
import { api } from "./api.ts";
import { Entry } from "./Workforce.tsx";
import { SafetyDocumentComposer } from "./SafetyDocumentComposer.tsx";
import "./safety-composer.css";
export function Documents({ pid }: { pid: string }) {
  const [state, setState] = useState<any>(null),
    [error, setError] = useState("");
  const refresh = async () =>
    setState(await api("document-intelligence?pid=" + encodeURIComponent(pid)));
  useEffect(() => {
    if (pid) refresh().catch((e) => setError(e.message));
  }, [pid]);
  const send = async (action: string, data: any) => {
    await api("document-intelligence", { pid, action, data });
    await refresh();
  };
  if (!pid) return <p>Select a project first.</p>;
  return (
    <>
      <p className="warning">
        AI generation is disabled. These are human-authored, source-linked
        drafts requiring independent review. Engineering approvals remain
        separate.
      </p>
      {error && <p role="alert">{error}</p>}
      {state && (
        <>
          <section>
            <Entry
              title="Register source revision"
              fields={[
                "title",
                "reference",
                "content",
                "replaces (record ID or none)",
              ]}
              submit={(d) =>
                send("source", {
                  ...d,
                  replaces:
                    d["replaces (record ID or none)"] === "none"
                      ? null
                      : d["replaces (record ID or none)"],
                })
              }
            />
            <h3>Source register</h3>
            <ul>
              {state.sources.map((r: any) => (
                <li key={r.id}>
                  <code>{r.id}</code> · {r.data.title || r.kind} ·{" "}
                  {r.data.reference || ""}
                  <details>
                    <summary>Read source</summary>
                    <pre
                      style={{
                        whiteSpace: "pre-wrap",
                        overflowWrap: "anywhere",
                      }}
                    >
                      {JSON.stringify(r.data, null, 2)}
                    </pre>
                  </details>
                </li>
              ))}
            </ul>
          </section>
          <SafetyDocumentComposer sources={state.sources} send={send} />
          <section>
            <Entry
              title="Create source-linked draft"
              fields={[
                "type",
                "title",
                "source record ID",
                "exact source excerpt",
                "proposals",
                "limitations",
                "replaces (record ID or none)",
              ]}
              submit={(d) =>
                send("draft", {
                  ...d,
                  replaces:
                    d["replaces (record ID or none)"] === "none"
                      ? null
                      : d["replaces (record ID or none)"],
                  sources: [
                    {
                      recordId: d["source record ID"],
                      excerpt: d["exact source excerpt"],
                    },
                  ],
                })
              }
            />
            <p>
              Type: RAMS, CPP, survey or specification. Source excerpts must
              match the registered source. Proposals and gaps are listed
              separately.
            </p>
          </section>
          <section>
            <h2>Document revisions</h2>
            {state.documents.map((r: any) => (
              <article key={r.id}>
                <h3>
                  {r.data.title} · revision {r.data.version}
                </h3>
                <p>{r.status}</p>
                <code>{r.id}</code>
                <p>
                  <a
                    href={
                      "/api/document-pdf?pid=" +
                      encodeURIComponent(pid) +
                      "&id=" +
                      encodeURIComponent(r.id)
                    }
                  >
                    Download review PDF
                  </a>
                </p>
                <details>
                  <summary>Read draft and source evidence</summary>
                  <p>{r.data.proposals}</p>
                  <p>Gaps: {r.data.limitations}</p>
                  <ul>
                    {r.data.sources.map((s: any) => (
                      <li key={s.recordId}>
                        {s.reference}: {s.excerpt}
                      </li>
                    ))}
                  </ul>
                </details>
              </article>
            ))}
          </section>
          <section>
            <Entry
              title="Record independent document review"
              fields={[
                "documentId",
                "decision",
                "note",
                "attestation (type reviewed)",
              ]}
              submit={(d) =>
                send("review", {
                  ...d,
                  attest: d["attestation (type reviewed)"] === "reviewed",
                })
              }
            />
            <p>
              Decision: accepted or rejected. Only an independent manager can
              record review. Review the full PDF and sources first.
            </p>
          </section>
        </>
      )}
    </>
  );
}
