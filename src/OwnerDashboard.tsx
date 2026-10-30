import React, { useEffect, useState } from "react";
import { api } from "./api.ts";
import type { Project, RecordItem, Snapshot } from "./model.ts";
import { current } from "./tender.ts";

type Phase = { title: string; route: string; subtitle: string; match: (kind: string) => boolean };
const phases: Phase[] = [
  { title: "Survey", route: "survey", subtitle: "Roof conditions & evidence", match: k => /^(roof|survey|defect|photo)/i.test(k) },
  { title: "Estimate", route: "estimating", subtitle: "Materials, options & costs", match: k => /^(material|source|tender|estimate|pricing|option|takeoff|document)/i.test(k) },
  { title: "Engineering", route: "design", subtitle: "Drawings & independent review", match: k => /^(drawing|load|mandate|engineering|rfi|query)/i.test(k) },
  { title: "Construction", route: "construction", subtitle: "Controls, workforce & inspections", match: k => /^(workplan|control|programme|diary|workRelease|gateReview|permit|inspection|itp|workforce)/i.test(k) },
  { title: "Handover", route: "handover", subtitle: "Quality, O&M & client closeout", match: k => /^(snag|handover|quality|om|closeout)/i.test(k) },
];

type SiteSignal = "green" | "amber" | "red" | "unknown";
function siteSignal(status: string): SiteSignal {
  const normalized = status.trim().toLowerCase();
  if (["on programme", "on program", "on track"].includes(normalized)) return "green";
  if (["at risk", "attention required"].includes(normalized)) return "amber";
  if (["delayed", "behind programme", "behind program"].includes(normalized)) return "red";
  return "unknown";
}
const signalLabels: Record<SiteSignal, string> = {
  green: "On programme (recorded)",
  amber: "Attention required (recorded)",
  red: "Delayed (recorded)",
  unknown: "Status not reported",
};
type DirectorRow = { projectId:string; projectName:string; allocatedWorkers:number; attendanceEvents:number; attendancePending:number; dailyReports:number; dailyPending:number; photos:number; materialRequests:number; materialPending:number };
function DirectorWorkforce({ select }: { select?: (id:string)=>void }) {
  const [rows,setRows] = useState<DirectorRow[]|null>(null);
  const [error,setError] = useState("");
  const [loading,setLoading] = useState(false);
  async function load() {
    setLoading(true);setError("");
    try { setRows(await api("workforce-director") as DirectorRow[]); }
    catch(e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }
  useEffect(()=>{ void load(); },[]);
  return <section className="owner-workforce" aria-labelledby="director-workforce-heading">
    <div className="owner-section-head"><h2 id="director-workforce-heading">Director workforce overview</h2><button className="quiet" type="button" onClick={()=>void load()} disabled={loading}>{loading?"Refreshing…":"Refresh"}</button></div>
    <p className="owner-disclaimer">Recorded test activity only. Attendance events do not establish current presence. Pending reviews require human decisions.</p>
    {error && <p role="alert">{error}</p>}
    {!rows && !error && <p role="status">Loading workforce records…</p>}
    <div className="owner-workforce-grid">
    {rows?.map(r=><article className="owner-workforce-card" key={r.projectId}>
      <h3>{r.projectName}</h3>
      <dl>
        <div><dt>Allocated workers</dt><dd>{r.allocatedWorkers}</dd></div>
        <div><dt>Attendance events / awaiting review</dt><dd>{r.attendanceEvents} / {r.attendancePending}</dd></div>
        <div><dt>Daily reports / awaiting review</dt><dd>{r.dailyReports} / {r.dailyPending}</dd></div>
        <div><dt>Submitted photographs</dt><dd>{r.photos}</dd></div>
        <div><dt>Materials requests / awaiting review</dt><dd>{r.materialRequests} / {r.materialPending}</dd></div>
      </dl>
      <a href="#workforce" onClick={()=>select?.(r.projectId)}>Open workforce records →</a>
    </article>)}
    </div>
    {rows?.length===0 && <p>No projects recorded.</p>}
  </section>;
}
export function OwnerDashboard({ snapshot, project, pid, onSelectProject, isDirector = false }: { snapshot: Snapshot; project?: Project; pid: string; onSelectProject?: (id: string) => void; isDirector?: boolean }) {
  const records = snapshot.records.filter(r => r.pid === pid && !r.kind.startsWith("commercial."));
  const stageCounts = phases.map(phase => records.filter(r => phase.match(r.kind)).length);
  const active = stageCounts.filter(n => n > 0).length;
  const roofRecords = current(records, "roof");
  const area = roofRecords.length ? roofRecords.reduce((sum, r) => sum + Number(r.data.area || 0), 0) : project?.area || 0;
  return (
    <div className="owner-dashboard">
      <div className="owner-film" aria-label="JR Roofing commercial roof drone footage">
        <video autoPlay muted loop playsInline preload="metadata" poster="/legacy/roof-poster.jpg" aria-label="Commercial roof drone flyover">
          <source src="/legacy/roof-drone.mp4" type="video/mp4" />
        </video>
        <div className="owner-film-shade" aria-hidden="true" />
        <div className="owner-film-caption">
          <span>JR ROOFING CONTRACTS</span>
          <strong>ROOFING INTELLIGENCE</strong>
          <small>FROM SURVEY TO HANDOVER</small>
        </div>
      </div>
      <div className="owner-hero">
        <div>
          <p className="owner-kicker">PROJECT OVERVIEW</p>
          <h2>{project ? project.name : "Your roofing workspace"}</h2>
          <p>{project ? [project.client, project.address].filter(Boolean).join(" · ") : "Start with a project, then move from survey to client handover."}</p>
          <a className="owner-action" href={project ? "#survey" : "#projects"}>{project ? "Continue roof survey →" : "Create your first project →"}</a>
        </div>
        <div className="owner-hero-stat" aria-label="Stages with recorded activity">
          <strong>{active} / 5</strong>
          <span>Stages with recorded activity</span>
        </div>
      </div>
      <div className="owner-metrics" aria-label="Project metrics">
        <div><small>Projects</small><strong>{snapshot.projects.length}</strong></div>
        <div><small>Evidence records</small><strong>{records.length}</strong></div>
        <div><small>{roofRecords.length ? "Surveyed roof area" : "Estimated roof area"}</small><strong>{area.toLocaleString("en-GB")} m²</strong></div>
      </div>
      <section className="owner-site-overview" aria-labelledby="owner-sites-heading">
        <div className="owner-section-head">
          <div><p className="owner-kicker">DIRECTOR VIEW</p><h2 id="owner-sites-heading">Project status overview</h2></div>
          <a href="#projects">Open project register →</a>
        </div>
        <p className="owner-disclaimer">Traffic lights reflect only an explicitly recorded project status, not live GPS attendance, safety clearance, programme verification or inferred performance. Unrecognised or missing statuses remain unreported.</p>
        {snapshot.projects.length === 0 ? (
          <p>No projects available yet.</p>
        ) : (
          <div className="owner-site-grid">
            {snapshot.projects.map(p => {
              const signal = siteSignal(p.status || "");
              const evidenceCount = snapshot.records.filter(r => r.pid === p.id).length;
              return (
                <article key={p.id} className={`owner-site-card owner-site-${signal}`}>
                  <div className="owner-site-status"><span className="owner-site-dot" aria-hidden="true" />{signalLabels[signal]}</div>
                  <h3>{p.name}</h3>
                  <p>{p.client || "Client not recorded"}</p>
                  <small>{evidenceCount} recorded item{evidenceCount === 1 ? "" : "s"} · {p.status || "No project status recorded"}</small>
                  {onSelectProject && <button type="button" className="quiet" onClick={() => onSelectProject(p.id)} aria-pressed={p.id === pid}>{p.id === pid ? "Current project" : "Select project"}</button>}
                </article>
              );
            })}
          </div>
        )}
      </section>
      {isDirector && <DirectorWorkforce select={onSelectProject} />}
      <div className="owner-section-head">
        <div><p className="owner-kicker">WORKFLOW</p><h2>Five stages, one project</h2></div>
        <span>{active} of 5 stages have activity</span>
      </div>
      <div className="owner-progress" role="progressbar" aria-label="Stages with recorded activity, not approvals" aria-valuenow={active} aria-valuemin={0} aria-valuemax={5}><span style={{ width: `${active * 20}%` }} /></div>
      <p className="owner-disclaimer">Activity indicators show records present, not task completion, engineering approval or permission to work.</p>
      <div className="owner-stages">
        {phases.map((phase, index) => (
          <a className="owner-stage" href={project ? `#${phase.route}` : "#projects"} key={phase.route}>
            <span className="owner-stage-number">0{index + 1}</span>
            <strong>{phase.title}</strong>
            <span>{phase.subtitle}</span>
            <small>{!project ? "Create a project" : stageCounts[index] ? `${stageCounts[index]} recorded item${stageCounts[index] === 1 ? "" : "s"}` : "No activity yet"}</small>
            <span className="owner-stage-link">Open stage →</span>
          </a>
        ))}
      </div>
      <section className="owner-activity" aria-labelledby="owner-activity-heading">
        <div className="owner-section-head">
          <div><p className="owner-kicker">PROJECT HISTORY</p><h2 id="owner-activity-heading">Latest recorded activity</h2></div>
          <a href="#projects">Project register →</a>
        </div>
        {!project ? (
          <p>Create or select a project to see its record history.</p>
        ) : records.length === 0 ? (
          <p>No project evidence has been recorded yet. Start with a roof survey.</p>
        ) : (
          <ol className="owner-activity-list">
            {[...records].sort((a,b) => b.createdAt.localeCompare(a.createdAt)).slice(0,6).map(record => (
              <li key={record.id}>
                <div><strong>{record.kind.replace(/[._]/g, " ")}</strong><span>Recorded evidence — not an approval</span></div>
                <time dateTime={record.createdAt}>{new Date(record.createdAt).toLocaleString("en-GB", {dateStyle:"medium", timeStyle:"short"})}</time>
              </li>
            ))}
          </ol>
        )}
      </section>
      <div className="owner-next">
        <div><h2>Document & site controls</h2><p>Access RAMS, CPP, document revisions, approvals and workforce evidence. Human engineering and safety approvals remain mandatory.</p></div>
        <div className="owner-next-links"><a href={project ? "#commercial" : "#projects"}>Commercial control →</a><a href={project ? "#documents" : "#projects"}>Document intelligence →</a><a href={project ? "#workforce" : "#projects"}>Subcontractors & workforce →</a><a href="#legacy">Original V3.6 workspace →</a></div>
      </div>
    </div>
  );
}
