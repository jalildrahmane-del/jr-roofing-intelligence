import React from "react";
import type { RecordItem } from "./model.ts";
import { constructionOverview } from "./construction-intelligence.ts";
import "./construction-intelligence.css";

export function ConstructionIntelligence({records}:{records:RecordItem[]}) {
  const today = new Date().toISOString().slice(0,10);
  const report = constructionOverview(records,today);
  return (
    <section className="construction-intelligence" aria-labelledby="construction-overview-heading">
      <div className="construction-overview-heading">
        <div><p className="eyebrow">SITE OPERATIONS</p><h2 id="construction-overview-heading">Construction intelligence</h2></div>
        <small>As recorded · {today}</small>
      </div>
      <p>Programme progress, potential delays and site diary evidence are derived from current project records. They do not certify work completion or authorise access.</p>
      <div className="construction-metrics">
        <div><small>Programme tasks</small><strong>{report.tasks.length}</strong></div>
        <div><small>Tasks marked 100%</small><strong>{report.tasksCompleted}</strong></div>
        <div><small>Potentially overdue</small><strong>{report.overdueTasks}</strong></div>
        <div><small>Unweighted task progress</small><strong>{report.averageProgress === null ? "Not available" : report.averageProgress + "%"}</strong></div>
        <div><small>Site diaries</small><strong>{report.diaries.length}</strong></div>
        <div><small>Control records</small><strong>{report.controls.length}</strong></div>
      </div>
      <p className="construction-note">Task progress is a simple unweighted mean of manually recorded percentages, not earned value or a programme critical-path calculation. Dates are compared as calendar days.</p>
      <div className="construction-overview-columns">
        <div>
          <h3>Programme and potential delays</h3>
          {!report.tasks.length ? <p>No programme tasks saved. Add tasks in the construction programme section below.</p> :
            <div className="table-wrap"><table>
              <thead><tr><th>Task</th><th>Progress</th><th>Planned finish</th><th>Variance to baseline</th><th>Flag</th></tr></thead>
              <tbody>{report.tasks.map(task => <tr key={task.id}>
                <th>{task.title}</th>
                <td>{task.progress === null ? "Not recorded" : task.progress + "%"}</td>
                <td>{task.plannedEnd || "Not recorded"}</td>
                <td>{task.baselineSlippageDays === null ? "Unknown" : (task.baselineSlippageDays > 0 ? "+" : "") + task.baselineSlippageDays + " days"}</td>
                <td>{task.overdue ? <span className="construction-flag">Past planned finish</span> : task.actualEnd ? "Actual finish recorded" : "No overdue flag"}</td>
              </tr>)}</tbody>
            </table></div>}
        </div>
        <div>
          <h3>Pre-start controls</h3>
          <p><strong>{report.prestartReleaseRecorded ? "Recorded pre-start release exists" : "No recorded pre-start release"}</strong></p>
          {report.blockers.length ? <><p>{report.blockers.length} current pre-start blockers / requirements:</p><ul>{report.blockers.slice(0,12).map((item,i) => <li key={i}>{item}</li>)}</ul>{report.blockers.length>12&&<p>Plus {report.blockers.length-12} further items; see formal gates below.</p>}</> : <p>No blockers returned by the recorded gate checks. Authorised personnel must still verify the current scope and permits.</p>}
          <h3>Recent site diary</h3>
          {!report.diaries.length ? <p>No daily diaries saved.</p> : report.diaries.slice(0,3).map(d => <article className="construction-diary" key={d.id}>
            <strong>{d.data.date || "Undated"} · {d.data.title || "Site diary"}</strong>
            <p>{d.data.work || "No activities entered"}</p>
            <small>Weather: {d.data.weather || "Not recorded"} · Labour/plant: {d.data.labour || "Not recorded"}</small>
            {d.data.events&&<p><strong>Delays / events:</strong> {d.data.events}</p>}
          </article>)}
        </div>
      </div>
    </section>
  );
}
