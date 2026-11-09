import { test } from "node:test";
import assert from "node:assert/strict";
import { measureRoofPlan } from "../src/roof-plan-geometry.ts";
const square = [{x:0,y:0},{x:100,y:0},{x:100,y:100},{x:0,y:100}];
const calibration = {pointA:{x:0,y:0},pointB:{x:100,y:0},actualDistanceMetres:10};

test("calibrated square gives plan area, perimeter and explicit unverified status", () => {
  const result = measureRoofPlan(square, calibration);
  assert.equal(result.planAreaM2,100);
  assert.equal(result.perimeterM,40);
  assert.equal(result.surfaceAreaM2,null);
  assert.equal(result.status,"preliminary-unverified");
});

test("pitch-adjusted surface area is not silently substituted for plan area", () => {
  const result = measureRoofPlan(square,calibration,60);
  assert.equal(result.planAreaM2,100);
  assert.ok(Math.abs(result.surfaceAreaM2! - 200)<1e-9);
  assert.equal(result.pitchDegrees,60);
});

test("polygon orientation does not change area", () => {
  assert.equal(measureRoofPlan([...square].reverse(),calibration).planAreaM2,100);
});

test("concave polygons are supported", () => {
  const points=[{x:0,y:0},{x:100,y:0},{x:100,y:50},{x:50,y:50},{x:50,y:100},{x:0,y:100}];
  assert.equal(measureRoofPlan(points,calibration).planAreaM2,75);
});

test("self-crossing polygons are rejected", () => {
  const crossed=[{x:0,y:0},{x:100,y:100},{x:0,y:100},{x:100,y:0}];
  assert.throws(()=>measureRoofPlan(crossed,calibration),/intersect/);
});

test("invalid calibration and pitches are rejected", () => {
  assert.throws(()=>measureRoofPlan(square,{...calibration,actualDistanceMetres:0}),/Calibration/);
  assert.throws(()=>measureRoofPlan(square,{...calibration,pointB:{x:0,y:0}}),/distinct/);
  assert.throws(()=>measureRoofPlan(square,calibration,90),/pitch/);
  assert.throws(()=>measureRoofPlan(square,calibration,Number.NaN),/pitch/);
});

test("invalid vertices and zero-area polygons are rejected", () => {
  assert.throws(()=>measureRoofPlan(square.slice(0,2),calibration),/vertices/);
  assert.throws(()=>measureRoofPlan([{x:0,y:0},{x:1,y:1},{x:2,y:2}],calibration),/non-zero/);
  assert.throws(()=>measureRoofPlan([{x:0,y:0},{x:1,y:0},{x:1,y:0}],calibration),/distinct/);
});
