import { Store } from "../server/store.ts";
import { randomBytes, randomUUID } from "node:crypto";
import { workforceCommand, workforceState } from "../server/workforce.ts";
import type { Role, User } from "../src/model.ts";
export function comparisonFixture(path=":memory:") {
  const store=new Store(path),key=randomBytes(32);
  const add=(name:string,role:Role,company="Main"):User=>({id:store.addUser(name,"synthetic-password",role,company),name,role,company});
  const manager=add("comparison-manager","manager"),supervisor=add("comparison-supervisor","supervisor"),unassigned=add("comparison-unassigned","supervisor"),worker=add("comparison-worker","worker","Alpha"),other=add("comparison-other","worker","Beta"),owner=add("comparison-owner","subcontractor-owner","Alpha");
  const pid=store.project(manager,{name:"Synthetic workforce comparison"}).id;
  const cmd=(actor:User,action:string,data:any)=>workforceCommand(store,actor,pid,action,data,key) as any;
  cmd(manager,"config",{latitude:51,longitude:0,radiusMetres:100,supervisors:[supervisor.id],syntheticOnly:true});
  for(const who of [worker,other])cmd(manager,"allocation",{workerId:who.id,active:true,shift:"Day",rate:20});
  cmd(manager,"owner",{ownerId:owner.id,active:true});
  const plan=(who=worker,extra:any={})=>cmd(manager,"shift",{workerId:who.id,start:"2026-10-26T08:00:00Z",end:"2026-10-26T16:00:00Z",breakMinutes:30,reason:"Synthetic planned roof work",...extra});
  const attendance=(who=worker,reviewFinish=true)=>{
    const events=[];
    for(const [event,time] of [["in","08:00"],["break-start","12:00"],["break-end","12:30"],["out","15:30"]]){
      const at=`2026-10-26T${time}:00Z`;
      const record=cmd(who,"event",{event,offline:true,capturedAt:at,requestId:randomUUID()});events.push(record);
      if(event!=="out"||reviewFinish)cmd(supervisor,"review",{eventId:record.id,decision:"accepted",reason:"Synthetic independent time verification",correctedAt:at});
    }
    return events;
  };
  const state=(who=manager)=>workforceState(store,who,pid);
  const matching=(row:any,extra:any={})=>({planRevisionId:row.revisionId,inputFingerprint:row.inputFingerprint,previousMatchId:row.latestMatch?.id??null,decision:"confirmed",attest:true,reason:"Synthetic plan and attendance evidence checked",...extra});
  return {store,key,manager,supervisor,unassigned,worker,other,owner,pid,cmd,plan,attendance,state,matching};
}
