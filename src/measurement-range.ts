/** Sensitivity to calibration distance only; not a survey accuracy certification. */
export function calibrationRange(area: number, perimeter: number, distance: number, tolerance: number) {
  if (![area, perimeter, distance, tolerance].every(Number.isFinite) || area <= 0 || perimeter <= 0 || distance <= 0 || tolerance < 0 || tolerance >= distance) {
    throw new Error('Calibration tolerance must be non-negative and smaller than the verified distance.');
  }
  const low = (distance - tolerance) / distance, high = (distance + tolerance) / distance;
  const values = { areaMin: area * low * low, areaMax: area * high * high, perimeterMin: perimeter * low, perimeterMax: perimeter * high };
  if (!Object.values(values).every(Number.isFinite)) throw new Error('Calibration range exceeds supported numeric limits.');
  return values;
}
