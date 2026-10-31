import React, { useState, useEffect } from "react";
import { api } from "./api.ts";
import { Entry } from "./Workforce.tsx";
import { SafetyDocumentComposer } from "./SafetyDocumentComposer.tsx";
import { DocumentRevisionEditor } from "./DocumentRevisionEditor.tsx";
import { DocumentReview } from "./DocumentReview.tsx";
import "./safety-composer.css";
export function Documents({ pid }: { pid: string }) {
  const [state, setState] = useState<any>(null),
    [error, setError] = useState(""), [editing,setEditing] = useState<any>(null);
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
            {state.canWrite&&<Entry
              title="Register source revision"
              labels={{"replaces (record ID or none)":"Source to replace"}}
              choices={{"replaces (record ID or none)":[{value:"none",label:"New source"},...state.sources.filter((r:any)=>r.current).map((r:any)=>({value:r.id,label:`${r.data.title} · ${r.data.reference}`}))]}}
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
            />}
            <h3>Source register</h3>
            <ul>
              {state.sources.map((r: any) => (
                <li key={r.id}>
                  {r.data.title || r.kind} ·{" "}
                  {r.data.reference || ""}
                  {r.current?" · current revision":" · superseded"}
                  <details>
                    <summary>Read source</summary>
                    <pre
                      style={{
                        whiteSpace: "pre-wrap",
                        overflowWrap: "anywhere",
                      }}
                    >
                      {r.data.content || "No source text recorded."}
                    </pre>
                  </details>
                </li>
              ))}
            </ul>
          </section>
          {!state.canWrite&&<p className="warning">You have read-only access to this project's documents.</p>}
          {state.canWrite&&<SafetyDocumentComposer sources={state.sources.filter((s:any)=>s.current)} send={send} />}
          {state.canWrite&&<section>
            <Entry
              title="Create source-linked draft"
              labels={{"source record ID":"Registered source", "replaces (record ID or none)":"Document to replace"}}
              choices={{type:["RAMS","CPP","survey","specification"].map(value=>({value,label:value})),"source record ID":state.sources.filter((r:any)=>r.current).map((r:any)=>({value:r.id,label:`${r.data.title || r.kind} · ${r.data.reference || ""}`})),"replaces (record ID or none)":[{value:"none",label:"New document"},...state.documents.filter((r:any)=>r.status!=="Superseded").map((r:any)=>({value:r.id,label:`${r.data.title} · revision ${r.data.version}`}))]}}
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
          </section>}
          {state.canWrite&&editing&&<DocumentRevisionEditor key={editing.id} document={editing} sources={state.sources.filter((s:any)=>s.current)} send={send} close={()=>setEditing(null)}/>}
          <section>
            <h2>Document revisions</h2>
            {state.documents.map((r: any) => (
              <article key={r.id}>
                <h3>
                  {r.data.title} · revision {r.data.version}
                </h3>
                <p>{r.status}</p>
                {state.canWrite&&r.status!=="Superseded"&&<button type="button" className="quiet" onClick={()=>setEditing(r)}>Revise document</button>}

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
                  <p style={{whiteSpace:"pre-wrap"}}>{r.data.proposals}</p>
                  <p>Gaps: {r.data.limitations}</p>
                  <ul>
                    {r.data.sources.map((s: any) => (
                      <li key={s.recordId}>
                        {s.reference}: {s.excerpt}
                      </li>
                    ))}
                  </ul>
                </details>
                {r.reviewHistory.length>0&&<details>
                  <summary>Review history ({r.reviewHistory.length})</summary>
                  {r.reviewHistory.map((review:any)=><div key={review.id}>
                    <p>{review.reviewerName} · {review.createdAt} · {review.data.decision}</p>
                    <p>{review.data.note}</p>
                    {review.data.checklistItems?<ul>{review.data.checklistItems.map((item:any)=><li key={item.id}>{item.confirmed?"Confirmed":"Not confirmed"}: {item.label}</li>)}</ul>:<p>Historical review: no structured checklist recorded.</p>}
                  </div>)}
                </details>}
              </article>
            ))}
          </section>
          {state.canWrite&&state.canReview&&<DocumentReview pid={pid} documents={state.documents} send={send}/>}
        </>
      )}
    </>
  );
}
