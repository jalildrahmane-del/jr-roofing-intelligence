import { measureRoofPlan, type PlanPoint } from "./roof-plan-geometry.ts";
export type SavedRoofPlan = {
  vertices: PlanPoint[];
  calibrationPoints: [PlanPoint, PlanPoint];
  actualDistanceMetres: number;
  pitchDegrees: number | null;
  status: "preliminary-unverified";
  imageAssetId?: string;
};
/** Revalidate all client-provided geometry before persisting a roof revision. */
export function parseRoofPlan(value: unknown): SavedRoofPlan | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || value.length > 35000) throw Error("Invalid roof plan payload");
  let raw: any;
  try { raw = JSON.parse(value); } catch { throw Error("Invalid roof plan JSON"); }
  if (!raw || typeof raw !== "object" || !Array.isArray(raw.vertices) ||
      !Array.isArray(raw.calibrationPoints) || raw.calibrationPoints.length !== 2 ||
      typeof raw.actualDistanceMetres !== "number" ||
      (raw.pitchDegrees !== null && typeof raw.pitchDegrees !== "number") ||
      raw.status !== "preliminary-unverified") throw Error("Invalid roof plan structure");
  const measurement = measureRoofPlan(raw.vertices, {
    pointA: raw.calibrationPoints[0], pointB: raw.calibrationPoints[1],
    actualDistanceMetres: raw.actualDistanceMetres,
  }, raw.pitchDegrees === null ? undefined : raw.pitchDegrees);
  if (measurement.planAreaM2 > 10000000) throw Error("Roof plan area exceeds supported range");
  return { vertices: raw.vertices, calibrationPoints: raw.calibrationPoints,
    actualDistanceMetres: raw.actualDistanceMetres, pitchDegrees: raw.pitchDegrees,
    status: "preliminary-unverified",
    ...(raw.imageAssetId === undefined ? {} : {imageAssetId: typeof raw.imageAssetId === "string" && /^[a-f0-9-]{36}$/.test(raw.imageAssetId) ? raw.imageAssetId : (()=>{throw Error("Invalid image asset reference")})()}) };
}
