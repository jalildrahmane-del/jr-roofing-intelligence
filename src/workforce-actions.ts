import {returnedDailyReports} from "./daily-report-revisions.ts";
import type {RecordItem,User} from './model.ts';
import {materialFulfilment} from './material-fulfilment.ts';
export type WorkforceAction = {id:string;recordId:string;kind:'review'|'order'|'delivery'|'waiting'|'returned';title:string;detail:string;target:'attendance'|'daily'|'materials';urgent:boolean;overdue:boolean};
// Input must already be authorised using workforceState; never call with an unrestricted snapshot.
export function workforceActions(records:RecordItem[],user:User,today=new Date().toLocaleDateString('en-CA',{timeZone:'Europe/London'})):WorkforceAction[]{
 const result:WorkforceAction[]=[];
 const returned=new Set(returnedDailyReports(records,user.id).map(r=>r.id));
 const reviewer=['manager','supervisor'].includes(user.role);
 const latest=(kind:string,field:string,id:string)=>records.filter(r=>r.kind===kind&&r.data[field]===id).at(-1);
 const add=(r:RecordItem,kind:WorkforceAction['kind'],title:string,detail:string,target:WorkforceAction['target'],urgent=false,overdue=false)=>result.push({id:kind+':'+r.id,recordId:r.id,kind,title,detail,target,urgent,overdue});
 for(const r of records){
  if(r.kind==='workforce.event'&&!latest('workforce.review','eventId',r.id)&&reviewer&&r.author!==user.id&&r.data.workerId!==user.id)
   add(r,'review','Review attendance event',`${r.data.event} · ${r.createdAt}`,'attendance');
  if(r.kind==='workforce.daily-report'){
   const review=latest('workforce.daily-review','reportId',r.id);
   if(returned.has(r.id))add(r,'returned','Revise returned daily report',`${r.data.day} · ${review?.data.reason}`,'daily',true);
   if(!review&&reviewer&&r.author!==user.id)add(r,'review','Review daily report',`${r.data.day} · ${r.data.completed.slice(0,100)}`,'daily');
  }
  if(r.kind!=='workforce.material-request')continue;
  const f=materialFulfilment(records,r),urgent=r.data.priority==='urgent';
  const detail=`${r.data.description} · ${r.data.quantity} ${r.data.unit} · needed ${r.data.neededBy}`;
  if(!f.review){
   if(reviewer&&r.author!==user.id)add(r,'review','Review materials request',detail,'materials',urgent);
   else add(r,'waiting','Materials awaiting independent review',detail,'materials',urgent);
  }else if(f.review.data.decision==='approved'&&!f.order){
   add(r,user.role==='manager'?'order':'waiting',user.role==='manager'?'Record placed materials order':'Approved materials awaiting manager order',detail,'materials',urgent,r.data.neededBy<today);
  }else if(f.order&&f.remaining>0){
   add(r,reviewer?'delivery':'waiting',reviewer?'Check outstanding delivery':'Materials delivery outstanding',`${r.data.description} · ${f.remaining} ${r.data.unit} outstanding · expected ${f.order.data.expectedDate}`,'materials',urgent,f.order.data.expectedDate<today);
  }
 }
 return result.sort((a,b)=>Number(b.overdue)-Number(a.overdue)||Number(b.urgent)-Number(a.urgent)||a.id.localeCompare(b.id));
}
export function workforceActionLink(pid:string,action:WorkforceAction){
 const query=new URLSearchParams({site:pid,action:action.target,record:action.recordId});
 return '?'+query.toString()+'#workforce';
}
