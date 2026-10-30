import {test} from "node:test";
import assert from "node:assert/strict";
import {productivityReport,weekMonday} from "../src/productivity.ts";
const progress=(workerId:string,day:string,quantity:number,unit:string,evidence="photo-1")=>({kind:"workforce.progress",data:{workerId,day,quantity,unit,evidence}});
test("ISO weeks begin Monday across year boundaries",()=>{assert.equal(weekMonday("2027-01-01"),"2026-12-28");assert.throws(()=>weekMonday("2026-02-30"))});
test("reported quantities are grouped by unit and matched to same-week verified hours",()=>{
 const rows=productivityReport([progress("w1","2026-10-19",120,"m²"),progress("w1","2026-10-20",40,"m²"),progress("w1","2026-10-21",8,"each")],[{workerId:"w1",shifts:[{day:"2026-10-19",hours:8},{day:"2026-10-20",hours:8}]}]);
 assert.equal(rows.length,2);assert.equal(rows.find(r=>r.unit==="m²")?.quantityPerHour,10);assert.equal(rows.find(r=>r.unit==="each")?.reportedQuantity,8);
});
test("unverified shifts never become verified hours",()=>{
 const rows=productivityReport([progress("w1","2026-10-21",20,"m²")],[{workerId:"w1",shifts:[]}]);
 assert.equal(rows[0].verifiedHours,0);assert.equal(rows[0].quantityPerHour,null);
});
test("worker and week remain separate",()=>{
 const rows=productivityReport([progress("w1","2026-10-19",10,"m²"),progress("w2","2026-10-19",20,"m²"),progress("w1","2026-10-26",30,"m²")],[{workerId:"w1",shifts:[{day:"2026-10-19",hours:5},{day:"2026-10-26",hours:10}]},{workerId:"w2",shifts:[{day:"2026-10-19",hours:4}]}]);
 assert.equal(rows.length,3);assert.equal(rows.find(r=>r.workerId==="w2")?.quantityPerHour,5);
});
