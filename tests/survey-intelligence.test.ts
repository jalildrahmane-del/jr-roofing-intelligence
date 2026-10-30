import { test } from "node:test";
import assert from "node:assert/strict";
import { roofEvidenceSummary } from "../src/survey-intelligence.ts";
import type { RecordItem } from "../src/model.ts";
const rec = (id: string, kind: string, data: Record<string, unknown>): RecordItem =>
  ({id,pid:"p",kind,author:"u",createdAt:"2026-10-21T12:00:00Z",data});

test("roof summary flags missing access, limitations, drainage and photo evidence", () => {
  const [roof] = roofEvidenceSummary([rec("r1","roof",{entityId:"roof1",name:"North",area:"50",condition:"Poor"})]);
  assert.equal(roof.area,50);
  assert.equal(roof.gaps.length,4);
  assert.equal(roof.photos,0);
});

test("latest roof revisions are used, not duplicate historical roofs", () => {
  const summaries=roofEvidenceSummary([
    rec("r1","roof",{entityId:"roof1",name:"Old",area:30}),
    rec("r2","roof",{entityId:"roof1",name:"Updated",area:45}),
  ]);
  assert.equal(summaries.length,1);
  assert.equal(summaries[0].name,"Updated");
});

test("linked defect photos clear defect photo gap and are counted once", () => {
  const summaries=roofEvidenceSummary([
    rec("r1","roof",{entityId:"roof1",name:"North",area:20,access:"Scaffold",limitations:"No internal access",drainage:"Inspected"}),
    rec("d1","defect",{entityId:"defect1",roofId:"roof1"}),
    rec("p1","photo",{entityId:"photo1",defectId:"defect1",roofId:"roof1"}),
  ]);
  assert.equal(summaries[0].photos,1);
  assert.equal(summaries[0].unphotographedDefects,0);
  assert.equal(summaries[0].gaps.length,0);
});

test("photo on a different roof does not clear this roof evidence gap", () => {
  const summaries=roofEvidenceSummary([
    rec("r1","roof",{entityId:"roof1",name:"North",area:20}),
    rec("r2","roof",{entityId:"roof2",name:"South",area:40}),
    rec("p1","photo",{entityId:"photo1",roofId:"roof2"}),
  ]);
  assert.equal(summaries[0].photos,0);
  assert.equal(summaries[1].photos,1);
});
