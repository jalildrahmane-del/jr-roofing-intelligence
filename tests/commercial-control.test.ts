import {test} from "node:test";
import assert from "node:assert/strict";
import {commercialSummary,formatGBP} from "../src/commercial-control.ts";
import type {RecordItem} from "../src/model.ts";
const r=(id:string,kind:string,data:Record<string,unknown>):RecordItem=>({id,pid:"p",kind,author:"u",createdAt:"2026-10-21T10:00:00Z",data});
test("budget, commitments and actual costs are not double counted",()=>{
 const s=commercialSummary([r("b","commercial.budget",{amountPence:500000}),r("c","commercial.cost",{costType:"commitment",amountPence:100000}),r("a","commercial.cost",{costType:"actual",amountPence:60000})]);
 assert.equal(s.approvedBudgetPence,500000);assert.equal(s.committedPence,100000);assert.equal(s.actualPence,60000);assert.equal(s.forecastPence,null);
});
test("variation revisions replace earlier status and avoid duplicate totals",()=>{
 const s=commercialSummary([r("v1","commercial.variation",{reference:"V01",status:"proposed",amountPence:20000}),r("v2","commercial.variation",{entityId:"v1",reference:"V01",status:"accepted",amountPence:25000})]);
 assert.equal(s.variations.length,1);assert.equal(s.pendingVariationsPence,0);assert.equal(s.acceptedVariationsPence,25000);
});
test("rejected variations do not contribute to pending or accepted totals",()=>{
 const s=commercialSummary([r("v","commercial.variation",{reference:"V02",status:"rejected",amountPence:20000})]);
 assert.equal(s.pendingVariationsPence,0);assert.equal(s.acceptedVariationsPence,0);
});
test("missing budget is unknown rather than zero",()=>{
 const s=commercialSummary([]);assert.equal(s.approvedBudgetPence,null);assert.equal(formatGBP(null),"Not established");
});
