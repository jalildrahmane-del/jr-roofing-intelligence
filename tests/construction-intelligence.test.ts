import { test } from "node:test";
import assert from "node:assert/strict";
import { constructionOverview } from "../src/construction-intelligence.ts";
import type { RecordItem } from "../src/model.ts";
const r = (id:string,kind:string,data:Record<string,unknown>):RecordItem => ({id,pid:"p",kind,author:"u",createdAt:"2026-10-21T12:00:00Z",data});
test("programme dashboard reports overdue work and baseline finish slippage",()=>{
 const result=constructionOverview([
  r("p1","programme",{entityId:"task1",title:"Roof strip",progress:50,baselineEnd:"2026-10-10",plannedEnd:"2026-10-19"}),
  r("p2","programme",{entityId:"task2",title:"Insulation",progress:100,baselineEnd:"2026-10-20",plannedEnd:"2026-10-20"}),
 ],"2026-10-21");
 assert.equal(result.overdueTasks,1);
 assert.equal(result.tasksCompleted,1);
 assert.equal(result.averageProgress,75);
 assert.equal(result.tasks[0].baselineSlippageDays,9);
});
test("latest task revision replaces historical programme record",()=>{
 const result=constructionOverview([
  r("p1","programme",{entityId:"task1",title:"Old",progress:10,plannedEnd:"2026-10-01"}),
  r("p2","programme",{entityId:"task1",title:"Revised",progress:90,plannedEnd:"2026-10-25"}),
 ],"2026-10-21");
 assert.equal(result.tasks.length,1);
 assert.equal(result.tasks[0].title,"Revised");
 assert.equal(result.overdueTasks,0);
});
test("unknown progress is not silently converted into zero",()=>{
 const result=constructionOverview([r("p1","programme",{entityId:"task1",title:"Survey",progress:"",plannedEnd:"2026-10-25"})],"2026-10-21");
 assert.equal(result.tasks[0].progress,null);
 assert.equal(result.averageProgress,null);
});
test("site diaries use latest revision and are sorted by site date",()=>{
 const result=constructionOverview([
  r("d1","diary",{entityId:"diary1",date:"2026-10-20",title:"Original"}),
  r("d2","diary",{entityId:"diary1",date:"2026-10-20",title:"Updated"}),
  r("d3","diary",{entityId:"diary2",date:"2026-10-21",title:"Today"}),
 ],"2026-10-21");
 assert.equal(result.diaries.length,2);
 assert.equal(result.diaries[0].data.title,"Today");
 assert.equal(result.diaries[1].data.title,"Updated");
});

test("invalid calendar dates are rejected instead of silently normalised", () => {
 assert.throws(()=>constructionOverview([],"2026-02-30"),/valid reporting date/);
 const result=constructionOverview([r("x","programme",{entityId:"task-x",title:"Bad date",progress:0,plannedEnd:"2026-02-30"})],"2026-10-21");
 assert.equal(result.tasks[0].plannedEnd,"");
 assert.equal(result.overdueTasks,0);
});
