import { test } from "node:test";
import assert from "node:assert/strict";
import { compareTenderOptions } from "../src/commercial.ts";
import type { RecordItem } from "../src/model.ts";

const record = (id: string, kind: string, data: Record<string, unknown>): RecordItem =>
  ({ id, pid: "p", kind, author: "u", createdAt: "2026-10-21T12:00:00Z", data });
const roof = record("roof-v2", "roof", { entityId: "roof-1", area: 100 });
const material = record("mat-v1", "material", { entityId: "mat-1" });
const estimate = (id: string, net: number | null, options: {complete?: boolean; roofRevision?: string; materialRevision?: string} = {}) =>
  record(id, "estimate", { title: id, version: 1, pricing: {
    complete: options.complete ?? true, netPence: net, grossPence: net === null ? null : net + 2000,
    directPence: net === null ? null : net - 1000, profitPence: net === null ? null : 1000,
    lines: [{roofId: "roof-1", roofRevision: options.roofRevision ?? roof.id, materialId: "mat-1", materialRevision: options.materialRevision ?? material.id}],
  }});

test("commercial comparison identifies lowest current net quote, not lowest gross", () => {
  const rows = compareTenderOptions([estimate("higher", 11000), estimate("lower", 9000)], [roof], [material]);
  assert.equal(rows.find(r => r.id === "lower")?.lowestCurrentNet, true);
  assert.equal(rows.find(r => r.id === "higher")?.lowestCurrentNet, false);
  assert.equal(rows[0].profitPence, 1000);
});

test("stale roof or material sources exclude options from comparison", () => {
  const rows = compareTenderOptions([
    estimate("stale-roof", 100, {roofRevision: "old-roof"}),
    estimate("stale-material", 200, {materialRevision: "old-material"}),
    estimate("valid", 500),
    estimate("valid2", 700),
  ], [roof], [material]);
  assert.equal(rows[0].comparable, false);
  assert.equal(rows[1].comparable, false);
  assert.equal(rows[2].lowestCurrentNet, true);
  assert.equal(rows[0].lowestCurrentNet, false);
});

test("unpriced options never become zero-price winners", () => {
  const rows = compareTenderOptions([
    estimate("unpriced", null, {complete: false}),
    estimate("priced", 10000),
    estimate("priced2", 11000),
  ], [roof], [material]);
  assert.equal(rows[0].comparable, false);
  assert.equal(rows[0].netPence, null);
  assert.equal(rows[1].lowestCurrentNet, true);
});

test("single comparable option is not advertised as lowest comparison", () => {
  const rows = compareTenderOptions([estimate("only", 10000)], [roof], [material]);
  assert.equal(rows[0].lowestCurrentNet, false);
});
