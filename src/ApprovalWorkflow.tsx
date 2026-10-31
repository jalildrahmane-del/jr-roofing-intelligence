import React, { useState } from "react";
import type { User, RecordItem, Project } from "./model.ts";
import { api } from "./api.ts";
import { ConstructionIntelligence } from "./ConstructionIntelligence.tsx";
import { QualityIntelligence } from "./QualityIntelligence.tsx";
import { current } from "./tender.ts";
import {
  gateSchemas,
  engineeringKey,
  engineeringApproval,
  engineeringBlockers,
  constructionBlockers,
  closeoutBlockers,
  reviewFor,
  releaseKey,
  handoverKey,
} from "./gates.ts";
export function ApprovalWorkflow({
  route,
  pid,
  project,
  records,
  user,
  refresh,
}: {
  route: string;
  pid: string;
  project?: Project;
  records: RecordItem[];
  user: User;
  refresh: () => Promise<void>;
}) {
  const [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [editing, setEditing] = useState<Record<string, RecordItem | undefined>>(
      {},
    );
  const writable = ["manager", "engineer", "supervisor"].includes(user.role);
  async function save(kind: string, data: any) {
    setError("");
    setMessage("");
    setBusy(true);
    try {
      await api("records", { pid, kind, data });
      await refresh();
      setEditing((e) => ({ ...e, [kind]: undefined }));
      setMessage("Record saved. Approval status updated.");
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  const submit =
    (kind: string, extra: any = {}) =>
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const form = e.currentTarget,
        d: any = Object.fromEntries(new FormData(form));
      d.attest = d.attest === "on";
      if (kind === "engineeringReview")
        d.responses = [
          ...current(records, "query"),
          ...current(records, "rfi"),
        ].map((r) => ({ queryId: r.id, response: d["response_" + r.id] }));
      if (await save(kind, { ...d, ...extra })) form.reset();
    };
  const field = (
    name: string,
    label: string,
    type = "text",
    optional = false,
  ) => (
    <label key={name}>
      {label}
      {type === "textarea" ? (
        <textarea
          name={name}
          aria-label={label}
          required={!optional}
          maxLength={10000}
        />
      ) : (
        <input
          name={name}
          aria-label={label}
          type={type}
          required={!optional}
        />
      )}
    </label>
  );
  const attestation = (
    <label className="attestation">
      <input type="checkbox" name="attest" required /> I have personally
      reviewed the stated scope, evidence and current revisions, and am
      competent and authorised for this action. This records my human decision;
      software does not certify safety.
    </label>
  );
  const decisions = (
    <label>
      Decision
      <select name="decision" aria-label="Decision" required>
        <option value="">Select…</option>
        <option value="accepted">Accepted</option>
        <option value="failed">Failed</option>
        <option value="information-required">Information required</option>
      </select>
    </label>
  );
  const history = (items: RecordItem[]) => (
    <details>
      <summary>Audit history ({items.length})</summary>
      {items.map((r) => (
        <article key={r.id}>
          <p>
            {r.kind} · {r.createdAt} · actor {r.author} · record {r.id}
          </p>
          <pre>{JSON.stringify(r.data, null, 2)}</pre>
        </article>
      ))}
    </details>
  );
  const checklist = (errors: string[]) => (
    <div className={errors.length ? "warning" : "notice"} role="status">
      {errors.length ? (
        <ul>
          {errors.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ul>
      ) : (
        <p>
          Required recorded gates satisfied. An authorised person must still
          make an explicit decision.
        </p>
      )}
    </div>
  );
  if (!project)
    return (
      <section>
        <p>Select a project to manage approval gates.</p>
        <a href="#projects">Open Project Register</a>
      </section>
    );
  const engineering = engineeringApproval(records),
    accepted = records
      .filter(
        (r) =>
          r.kind === "handoverAcceptance" &&
          r.data.packageKey === handoverKey(records),
      )
      .at(-1);
  return (
    <div className="gate-workflow">
      <p className="warning">
        Human approval gates for {project.name}. Preliminary calculations and AI
        can never certify structural safety. Source references identify evidence
        held in the controlled project file; this application does not verify
        professional qualifications or the truth of submitted evidence.
      </p>
      {route === "construction" && <ConstructionIntelligence records={records} />}
      {(route === "quality" || route === "handover") && <QualityIntelligence records={records} mode={route} />}
      <p>
        Signed in as {user.name} · {user.role}
      </p>
      {error && (
        <p role="alert" className="warning">
          {error}
        </p>
      )}
      {message && <p role="status">{message}</p>}
      {route === "design" && (
        <section>
          <h2>Engineering approval gate</h2>
          {checklist(engineeringBlockers(records))}
          <p>
            {engineering
              ? "Authorised engineer review recorded for current package."
              : "Pending — no current authorised engineering acceptance."}
          </p>
          {user.role === "engineer" && (
            <form
              onSubmit={submit("engineeringReview", {
                packageKey: engineeringKey(records),
              })}
            >
              <h3>Record qualified engineer decision</h3>
              <label>
                Engineering decision
                <select
                  aria-label="Engineering decision"
                  name="decision"
                  required
                >
                  <option value="">Select…</option>
                  {["accepted", "rejected", "information-required"].map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </label>
              {[...current(records, "query"), ...current(records, "rfi")].map(
                (r) =>
                  field(
                    "response_" + r.id,
                    "Response: " + r.data.title,
                    "textarea",
                  ),
              )}
              {field("note", "Engineer review rationale", "textarea")}
              {field("source", "Signed engineering evidence reference")}
              {attestation}
              <button disabled={busy}>Record engineer decision</button>
            </form>
          )}
          {history(records.filter((r) => r.kind === "engineeringReview"))}
        </section>
      )}
      {Object.entries(gateSchemas)
        .filter(([, s]) => s.route === route)
        .map(([kind, schema]) => {
          const edit = editing[kind],
            items = current(records, kind),
            mayEdit =
              writable &&
              (kind !== "mandate" || user.role === "manager") &&
              (!["drawing", "loadcase", "query", "rfi"].includes(kind) ||
                ["manager", "engineer"].includes(user.role));
          return (
            <section key={kind}>
              <h2>{schema.title}</h2>
              {kind === "mandate" && (
                <p>
                  Managers must verify the engineer’s qualifications,
                  appointment and project scope externally before authorising an
                  existing engineer account. Revocation immediately invalidates
                  that engineer’s acceptance.
                </p>
              )}
              {items.map((r) => (
                <article key={r.id} className="gate-record">
                  <h3>
                    {r.data.title || r.data.scope || r.data.number} · v
                    {r.data.version}
                  </h3>
                  <p>
                    Recorded {r.createdAt} · actor {r.author}
                  </p>
                  <dl>
                    {schema.fields.map((f) => (
                      <React.Fragment key={f.name}>
                        <dt>{f.label}</dt>
                        <dd>{String(r.data[f.name] || "—")}</dd>
                      </React.Fragment>
                    ))}
                  </dl>
                  {mayEdit && (
                    <button
                      type="button"
                      onClick={() => setEditing((e) => ({ ...e, [kind]: r }))}
                    >
                      Revise {r.data.title || r.data.number || "authorisation"}
                    </button>
                  )}
                  {["control", "holdpoint", "snag", "handoverItem"].includes(
                    kind,
                  ) && (
                    <>
                      <p>
                        {reviewFor(records, r)
                          ? "Current independent acceptance recorded"
                          : "Pending / failed / expired — acceptance required"}
                      </p>
                      {["manager", "supervisor"].includes(user.role) &&
                        r.author !== user.id &&
                        (kind !== "handoverItem" ||
                          user.role === "manager") && (
                          <details>
                            <summary>Inspect and review {r.data.title}</summary>
                            <form
                              onSubmit={submit("gateReview", {
                                targetId: r.id,
                              })}
                            >
                              {decisions}
                              {field("note", "Inspection findings", "textarea")}
                              {field("source", "Inspection evidence reference")}
                              {field(
                                "competence",
                                "Reviewer competence reference",
                              )}
                              {attestation}
                              <button disabled={busy}>
                                Record inspection decision
                              </button>
                            </form>
                          </details>
                        )}
                    </>
                  )}
                  {kind === "control" &&
                    r.data.category === "hot-work" &&
                    ["manager", "supervisor"].includes(user.role) &&
                    r.author !== user.id && (
                      <details>
                        <summary>Fire watch closeout</summary>
                        <form
                          onSubmit={submit("permitClose", { targetId: r.id })}
                        >
                          {field(
                            "completedAt",
                            "Fire watch completion (UTC)",
                            "datetime-local",
                          )}
                          {field("note", "Fire watch findings", "textarea")}
                          {field("source", "Fire watch evidence reference")}
                          {attestation}
                          <button disabled={busy}>Close hot work permit</button>
                        </form>
                      </details>
                    )}
                </article>
              ))}
              {mayEdit && (
                <details key={edit?.id || "new"} open={!!edit}>
                  <summary>
                    {edit
                      ? "Revise record"
                      : "Add " + schema.title.toLowerCase()}
                  </summary>
                  <form onSubmit={submit(kind, { previousId: edit?.id || "" })}>
                    <h3>
                      {edit
                        ? "Revise " +
                          (edit.data.title ||
                            edit.data.number ||
                            "authorisation")
                        : "New record"}
                    </h3>
                    <div className="fields">
                      {schema.fields.map((f) => {
                        const options = f.ref
                          ? current(records, f.ref)
                              .filter(
                                (r) => r.data.entityId !== edit?.data.entityId,
                              )
                              .map((r) => ({
                                value: r.id,
                                label:
                                  (r.data.title || r.data.number || r.kind) +
                                  " · " +
                                  (r.data.revision ||
                                    "v" + (r.data.version || 1)) +
                                  " · " +
                                  r.id.slice(0, 8),
                              }))
                          : f.options?.map((v) => ({ value: v, label: v }));
                        return (
                          <label key={f.name}>
                            {f.label}
                            {options ? (
                              <select
                                name={f.name}
                                aria-label={f.label}
                                required={!f.optional}
                                defaultValue={edit?.data[f.name] || ""}
                              >
                                <option value="">Select…</option>
                                {options.map((o) => (
                                  <option key={o.value} value={o.value}>
                                    {o.label}
                                  </option>
                                ))}
                              </select>
                            ) : f.type === "textarea" ? (
                              <textarea
                                name={f.name}
                                aria-label={f.label}
                                required={!f.optional}
                                defaultValue={edit?.data[f.name] || ""}
                                maxLength={10000}
                              />
                            ) : (
                              <input
                                name={f.name}
                                aria-label={f.label}
                                required={!f.optional}
                                defaultValue={
                                  f.type === "datetime-local"
                                    ? (edit?.data[f.name] || "").slice(0, 16)
                                    : (edit?.data[f.name] ?? "")
                                }
                                type={f.type || "text"}
                                step={f.type === "number" ? "any" : undefined}
                                maxLength={10000}
                              />
                            )}
                          </label>
                        );
                      })}
                    </div>
                    {kind === "mandate" && attestation}
                    <button disabled={busy}>Save {kind}</button>
                    {edit && (
                      <button
                        type="button"
                        onClick={() =>
                          setEditing((e) => ({ ...e, [kind]: undefined }))
                        }
                      >
                        Cancel revision
                      </button>
                    )}
                  </form>
                </details>
              )}
              {history(
                records.filter(
                  (r) =>
                    r.kind === kind ||
                    (r.kind === "gateReview" &&
                      records.some(
                        (t) => t.kind === kind && t.id === r.data.targetId,
                      )),
                ),
              )}
            </section>
          );
        })}
      {route === "construction" && (
        <section>
          <h2>Work stage release</h2>
          <p>
            Each stage needs a fresh human release. Changing design or scope
            invalidates subsequent releases. Controls must be current when
            permission is recorded; expiry or changes require a new review and
            release before further work.
          </p>
          {["prestart", "installation", "final"].map((stage) => (
            <article key={stage}>
              <h3>{stage} release</h3>
              {checklist(constructionBlockers(records, stage))}
              {["manager", "supervisor"].includes(user.role) && (
                <form
                  onSubmit={submit("workRelease", {
                    stage,
                    packageKey: releaseKey(records, stage),
                  })}
                >
                  {field("note", "Release scope and limitations", "textarea")}
                  {attestation}
                  <button
                    disabled={
                      busy || constructionBlockers(records, stage).length > 0
                    }
                  >
                    Release {stage} work
                  </button>
                </form>
              )}
            </article>
          ))}
          {history(
            records.filter((r) =>
              ["workRelease", "permitClose"].includes(r.kind),
            ),
          )}
        </section>
      )}
      {route === "handover" && (
        <section>
          <h2>Handover approval gate</h2>
          {checklist(closeoutBlockers(records))}
          <p>
            {accepted
              ? "Handover acceptance recorded for this exact dossier."
              : "Pending — current dossier has no final acceptance."}
          </p>
          {user.role === "manager" && (
            <form
              onSubmit={submit("handoverAcceptance", {
                packageKey: handoverKey(records),
              })}
            >
              {field("note", "Handover review findings", "textarea")}
              {field("clientName", "Client representative")}
              {field("clientEvidence", "Signed client acceptance reference")}
              {field("clientAcceptedAt", "Client acceptance date", "date")}
              {attestation}
              <button disabled={busy || closeoutBlockers(records).length > 0}>
                Record handover acceptance
              </button>
            </form>
          )}
          <button
            type="button"
            onClick={async () => {
              try {
                const dossier = await api("dossiers/" + pid),
                  blob = new Blob([JSON.stringify(dossier, null, 2)], {
                    type: "application/json",
                  }),
                  url = URL.createObjectURL(blob),
                  a = document.createElement("a");
                a.href = url;
                a.download = "jr-handover-" + pid + ".json";
                a.click();
                setTimeout(() => URL.revokeObjectURL(url), 1000);
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            Export auditable project dossier
          </button>
          {history(records.filter((r) => r.kind === "handoverAcceptance"))}
        </section>
      )}
    </div>
  );
}
