import test from 'node:test';
import assert from 'node:assert/strict';
import { measureRoofPlan } from '../src/roof-plan-geometry.ts';
import { roofBoundaryCsv } from '../src/roof-measurement-csv.ts';
test('boundary CSV includes closing edge and preserves unrounded metres', () => {
 const result = measureRoofPlan([{x:0,y:0},{x:3,y:0},{x:3,y:4}], {pointA:{x:0,y:0},pointB:{x:3,y:0},actualDistanceMetres:3});
 assert.equal(roofBoundaryCsv(result), 'Status,Edge,Plan length (m)\r\nPreliminary - independently verify,1,3\r\nPreliminary - independently verify,2,4\r\nPreliminary - independently verify,3,5\r\n');
 assert.throws(() => roofBoundaryCsv({...result,edgeLengthsM:[NaN]}));
});
