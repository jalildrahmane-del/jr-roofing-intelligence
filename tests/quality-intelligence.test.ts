import {test} from "node:test";
import assert from "node:assert/strict";
import {qualityHandoverOverview} from "../src/quality-intelligence.ts";
import type {RecordItem} from "../src/model.ts";
const rec=(id:string,kind:string,data:Record<string,unknown>):RecordItem=>({id,pid:"p",kind,author:"author",createdAt:"2026-10-21T12:00:00Z",data});
test("unreviewed snags remain open and become overdue after due date",()=>{
 const result=qualityHandoverOverview([rec("s1","snag",{entityId:"snag-1",title:"Flashing defect",due:"2026-10-20"})],"2026-10-21");
 assert.equal(result.outstandingSnags.length,1);assert.equal(result.overdueSnags.length,1);
});
test("independent acceptance closes only exact snag revision",()=>{
 const records=[rec("s1","snag",{entityId:"snag-1",title:"Flashing",due:"2026-10-20"}),rec("a1","gateReview",{targetId:"s1",decision:"accepted"})];
 assert.equal(qualityHandoverOverview(records,"2026-10-21").outstandingSnags.length,0);
 records.push(rec("s2","snag",{entityId:"snag-1",title:"Revised flashing",due:"2026-10-22"}));
 assert.equal(qualityHandoverOverview(records,"2026-10-21").outstandingSnags.length,1);
});
test("all five handover categories are identified when absent",()=>{
 const result=qualityHandoverOverview([],"2026-10-21");
 assert.deepEqual(result.missingCategories,["O&M","as-built","warranty","test-certificate","maintenance"]);
 assert.equal(result.handoverAcceptanceRecorded,false);
});
test("a failed inspection is never reported as accepted",()=>{
 const result=qualityHandoverOverview([rec("h1","holdpoint",{entityId:"h",title:"Roof inspection",stage:"final"}),rec("r1","gateReview",{targetId:"h1",decision:"failed"})],"2026-10-21");
 assert.equal(result.acceptedInspections,0);
 assert.equal(result.inspections[0].status,"failed");
});
