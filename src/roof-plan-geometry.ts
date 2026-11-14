/** Preliminary 2D roof-plan measurements. Coordinates are image pixels, not geospatial positions.
 * A user must calibrate against a verified on-image dimension. Results are not a measured survey.
 */
export type PlanPoint = Readonly<{ x: number; y: number }>;
export type PlanMeasurement = Readonly<{
  planAreaM2: number;
  surfaceAreaM2: number | null;
  perimeterM: number;
  calibrationMetresPerPixel: number;
  pitchDegrees: number | null;
  status: "preliminary-unverified";
}>;

function validPoint(point: PlanPoint): boolean {
  return !!point && typeof point === "object" && Number.isFinite(point.x) && Number.isFinite(point.y);
}

function segmentIntersection(a: PlanPoint, b: PlanPoint, c: PlanPoint, d: PlanPoint): boolean {
  const cross = (p: PlanPoint, q: PlanPoint, r: PlanPoint) =>
    (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
  const onSegment = (p: PlanPoint, q: PlanPoint, r: PlanPoint) =>
    Math.min(p.x, q.x) <= r.x && r.x <= Math.max(p.x, q.x) &&
    Math.min(p.y, q.y) <= r.y && r.y <= Math.max(p.y, q.y);
  const abC = cross(a, b, c), abD = cross(a, b, d);
  const cdA = cross(c, d, a), cdB = cross(c, d, b);
  if ((abC > 0 && abD < 0 || abC < 0 && abD > 0) &&
      (cdA > 0 && cdB < 0 || cdA < 0 && cdB > 0)) return true;
  return (abC === 0 && onSegment(a, b, c)) ||
    (abD === 0 && onSegment(a, b, d)) ||
    (cdA === 0 && onSegment(c, d, a)) ||
    (cdB === 0 && onSegment(c, d, b));
}

export function measureRoofPlan(
  vertices: readonly PlanPoint[],
  calibration: Readonly<{ pointA: PlanPoint; pointB: PlanPoint; actualDistanceMetres: number }>,
  pitchDegrees?: number,
): PlanMeasurement {
  if (vertices.length < 3 || vertices.length > 500 || vertices.some(p => !validPoint(p))) {
    throw new Error("Provide 3–500 finite roof-boundary vertices.");
  }
  if (!validPoint(calibration.pointA) || !validPoint(calibration.pointB) ||
      !Number.isFinite(calibration.actualDistanceMetres) || calibration.actualDistanceMetres <= 0) {
    throw new Error("Calibration requires two finite points and a verified positive distance.");
  }
  const pixels = Math.hypot(calibration.pointB.x - calibration.pointA.x,
    calibration.pointB.y - calibration.pointA.y);
  if (!Number.isFinite(pixels) || pixels <= 0) throw new Error("Calibration points must be distinct.");
  if (pitchDegrees !== undefined &&
      (!Number.isFinite(pitchDegrees) || pitchDegrees < 0 || pitchDegrees >= 90)) {
    throw new Error("Roof pitch must be at least 0 and below 90 degrees.");
  }
  for (let i = 0; i < vertices.length; i++) {
    const a = vertices[i], b = vertices[(i + 1) % vertices.length];
    if (a.x === b.x && a.y === b.y) throw new Error("Consecutive vertices must be distinct.");
    for (let j = i + 1; j < vertices.length; j++) {
      if (j === i + 1 || (i === 0 && j === vertices.length - 1)) continue;
      if (segmentIntersection(a, b, vertices[j], vertices[(j + 1) % vertices.length])) {
        throw new Error("Roof boundary must not intersect itself.");
      }
    }
  }
  let twiceArea = 0, perimeterPixels = 0;
  for (let i = 0; i < vertices.length; i++) {
    const a = vertices[i], b = vertices[(i + 1) % vertices.length];
    // Translate to the first vertex to avoid cancellation for offset image coordinates.
    twiceArea += (a.x - vertices[0].x) * (b.y - vertices[0].y) -
      (b.x - vertices[0].x) * (a.y - vertices[0].y);
    perimeterPixels += Math.hypot(b.x - a.x, b.y - a.y);
  }
  if (!Number.isFinite(twiceArea) || Math.abs(twiceArea) <= 1e-9) {
    throw new Error("Roof boundary must enclose a non-zero area.");
  }
  const metresPerPixel = calibration.actualDistanceMetres / pixels;
  const planAreaM2 = Math.abs(twiceArea) / 2 * metresPerPixel ** 2;
  const surfaceAreaM2 = pitchDegrees === undefined
    ? null : planAreaM2 / Math.cos(pitchDegrees * Math.PI / 180);
  if (![planAreaM2, perimeterPixels * metresPerPixel, surfaceAreaM2 ?? 0].every(Number.isFinite)) {
    throw new Error("Measurement exceeds supported numeric range.");
  }
  return {
    planAreaM2, surfaceAreaM2,
    perimeterM: perimeterPixels * metresPerPixel,
    calibrationMetresPerPixel: metresPerPixel,
    pitchDegrees: pitchDegrees ?? null,
    status: "preliminary-unverified",
  };
}
