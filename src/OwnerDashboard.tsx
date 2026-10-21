import React from "react";
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

export function OwnerDashboard({ snapshot, project, pid }: { snapshot: Snapshot; project?: Project; pid: string }) {
  const records = snapshot.records.filter(r => r.pid === pid);
  const stageCounts = phases.map(phase => records.filter(r => phase.match(r.kind)).length);
  const active = stageCounts.filter(n => n > 0).length;
  const roofRecords = current(records, "roof");
  const area = roofRecords.length ? roofRecords.reduce((sum, r) => sum + Number(r.data.area || 0), 0) : project?.area || 0;
  return (
    <div className="owner-dashboard">
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
      <div className="owner-next">
        <div><h2>Document & site controls</h2><p>Access RAMS, CPP, document revisions, approvals and workforce evidence. Human engineering and safety approvals remain mandatory.</p></div>
        <div className="owner-next-links"><a href={project ? "#documents" : "#projects"}>Document intelligence →</a><a href={project ? "#workforce" : "#projects"}>Subcontractors & workforce →</a><a href="#legacy">Original V3.6 workspace →</a></div>
      </div>
    </div>
  );
}
