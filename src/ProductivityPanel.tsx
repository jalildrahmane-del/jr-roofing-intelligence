import { workforcePersonName } from "./workforce-people.ts";
import React from "react";
import { productivityReport } from "./productivity.ts";
import "./productivity.css";

export function ProductivityPanel({state}:{state:any}) {
  const rows=productivityReport(state.records || [],state.report || []);
  return (
    <section className="productivity-panel" aria-labelledby="productivity-title">
      <h2 id="productivity-title">Site productivity · indicative weekly comparison</h2>
      <p>Compares independently accepted shift hours with separately reported installation quantities for the same worker and calendar week. Quantities are not independently verified; this is not an earned-value, payroll or performance assessment.</p>
      {!rows.length ? <p>No reported quantities are available for a weekly comparison.</p> :
        <div className="table-wrap"><table>
          <thead><tr><th>Week commencing</th><th>Worker</th><th>Reported installation</th><th>Verified shift hours</th><th>Indicative quantity/hour</th><th>Evidence</th></tr></thead>
          <tbody>{rows.map(row=><tr key={JSON.stringify([row.workerId,row.week,row.unit])}>
            <td>{row.week}</td><td>{workforcePersonName(state,row.workerId)}</td>
            <td>{row.reportedQuantity.toLocaleString("en-GB")} {row.unit}</td>
            <td>{row.verifiedHours.toFixed(2)} h</td>
            <td>{row.quantityPerHour === null ? "Unavailable" : row.quantityPerHour.toFixed(2)+" "+row.unit+"/h"}</td>
            <td>{row.evidenceCount} reference{row.evidenceCount===1?"":"s"}<small>{row.warning}</small></td>
          </tr>)}</tbody>
        </table></div>}
      <p className="productivity-disclaimer">Do not combine m², linear metres and item counts. Work type, weather, access, shift allocation and quality checks must be reviewed before drawing conclusions.</p>
    </section>
  );
}
