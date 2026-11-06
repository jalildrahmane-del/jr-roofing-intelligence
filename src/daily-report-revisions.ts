import type {RecordItem} from './model.ts';
export function returnedDailyReports(records:RecordItem[],authorId:string){
 return records.filter(r=>r.kind==='workforce.daily-report'&&r.author===authorId&&
  records.filter(v=>v.kind==='workforce.daily-review'&&v.data.reportId===r.id).at(-1)?.data.decision==='returned'&&
  !records.some(v=>v.kind==='workforce.daily-report'&&v.data.replacesReportId===r.id));
}
export function retainedDailyPhotoIds(raw:string|undefined):string[]{
 if(raw===undefined||raw==='')return [];
 const ids=JSON.parse(raw);
 if(!Array.isArray(ids)||ids.length>4||ids.some(id=>typeof id!=='string'||!id||id.length>100)||new Set(ids).size!==ids.length)throw Error('Invalid retained photographs');
 return ids;
}
