import React, { useEffect, useState } from "react";
import { api } from "./api.ts";
export function ProjectAccess({ pid, refresh }: {pid:string;refresh:()=>Promise<void>}) {
  const [state,setState]=useState<any>(null),[userId,setUserId]=useState(""),[permission,setPermission]=useState("read"),[reason,setReason]=useState(""),[error,setError]=useState(""),[message,setMessage]=useState(""),[busy,setBusy]=useState(false);
  const load=async()=>setState(await api("project-access?pid="+encodeURIComponent(pid)));
  useEffect(()=>{load().catch(e=>setError(e.message));},[pid]);
  const latest=state?.history.filter((r:any)=>r.userId===userId).at(-1);
  const target=state?.users.find((u:any)=>u.id===userId);
  return <section aria-label="Project access management">
    <h2>Project team access</h2>
    <p>Assign registered engineers, supervisors and viewers to this project. Managers administer all projects. Workforce allocations are managed separately.</p>
    {error&&<p role="alert">{error}</p>}{message&&<p role="status">{message}</p>}
    {state&&<>
      <form onSubmit={async e=>{e.preventDefault();setBusy(true);setError("");setMessage("");try {
        await api("project-access",{pid,data:{userId,permission,reason,previousId:latest?.id??null}});
        await load();await refresh();setReason("");setMessage("Project permission updated.");
      }catch(err){setError((err as Error).message);}finally{setBusy(false);}}}>
        <label>Registered team member<select aria-label="Registered team member" value={userId} onChange={e=>{setUserId(e.target.value);setPermission("read");setMessage("");}} required><option value="">Select a team member</option>{state.users.map((u:any)=><option key={u.id} value={u.id}>{u.name} · {u.role}</option>)}</select></label>
        <p>Current permission: {latest?.permission||"none"}</p>
        <label>Project permission<select aria-label="Project permission" value={permission} onChange={e=>setPermission(e.target.value)}><option value="read">Read only</option>{target?.role!=="viewer"&&<option value="edit">Read and edit</option>}<option value="none">Revoke access</option></select></label>
        <label>Reason for access change<textarea aria-label="Reason for access change" value={reason} onChange={e=>setReason(e.target.value)} maxLength={2000} required/></label>
        <button disabled={busy||!userId}>{busy?"Saving…":"Update project permission"}</button>
      </form>
      <h3>Assignment history</h3>
      {state.history.length===0?<p>No staff assignments recorded. Staff have no document access until assigned.</p>:<ul>{state.history.map((r:any)=><li key={r.id}>{state.users.find((u:any)=>u.id===r.userId)?.name||"Former team member"} · {r.permission} · revision {r.version} · {r.createdAt}<p>{r.reason}</p></li>)}</ul>}
      <button type="button" className="quiet" disabled={busy} onClick={()=>{setError("");load().catch(e=>setError(e.message));}}>Refresh assignments</button>
    </>}
  </section>;
}
