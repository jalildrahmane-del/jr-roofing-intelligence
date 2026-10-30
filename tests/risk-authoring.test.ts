import { test } from "node:test";
import assert from "node:assert/strict";
import { riskScore, riskBand, formatSafetyDraft, formatRiskRows } from "../src/risk-authoring.ts";
const row = {activity:"Remove existing felt",hazard:"Falls from roof edge",persons:"Roofers",likelihood:4,severity:5,controls:"Competent scaffold inspection and edge protection verified before access",residualLikelihood:2,residualSeverity:5,responsible:"Site manager"};
test("5x5 risk score boundaries and bands",()=>{
  assert.equal(riskScore(1,1),1);
  assert.equal(riskScore(5,5),25);
  assert.equal(riskBand(4),"Low");
  assert.equal(riskBand(5),"Medium");
  assert.equal(riskBand(12),"Medium");
  assert.equal(riskBand(13),"High");
  assert.throws(()=>riskScore(0,5));
  assert.throws(()=>riskScore(2.5,3));
});
test("RAMS draft includes human entered controls and both ratings",()=>{
  const draft=formatSafetyDraft("RAMS","Roof strip and replacement","Scaffold, sequence and inspection", [row]);
  assert.match(draft,/Falls from roof edge/);
  assert.match(draft,/20 \(High\)/);
  assert.match(draft,/10 \(Medium\)/);
  assert.match(draft,/HUMAN-AUTHORED DRAFT/);
  assert.match(draft,/No permission to work is granted/);
});
test("CPP draft preserves site arrangements without claiming approval",()=>{
  const draft=formatSafetyDraft("CPP","Roof renewal","Welfare and emergency access", [row]);
  assert.match(draft,/CONSTRUCTION PHASE ARRANGEMENTS/);
  assert.match(draft,/independent manager/i);
});
test("reject incomplete hazard controls and out of range rows",()=>{
  assert.throws(()=>formatRiskRows([{...row,controls:""}]),/controls/);
  assert.throws(()=>formatRiskRows([{...row,severity:6}]),/integers/);
  assert.throws(()=>formatRiskRows([]),/between 1 and 25/);
});
