import test from 'node:test';
import assert from 'node:assert/strict';
import { calibrationRange } from '../src/measurement-range.ts';
test('calibration distance tolerance scales area quadratically and lengths linearly', () => {
 const r=calibrationRange(200,60,20,1);
 assert.ok(Math.abs(r.areaMin-180.5)<1e-9);
 assert.ok(Math.abs(r.areaMax-220.5)<1e-9);
 assert.equal(r.perimeterMin,57);assert.equal(r.perimeterMax,63);
 assert.deepEqual(calibrationRange(200,60,20,0),{areaMin:200,areaMax:200,perimeterMin:60,perimeterMax:60});
 for(const t of [-1,20,NaN,Infinity])assert.throws(()=>calibrationRange(200,60,20,t));
});
