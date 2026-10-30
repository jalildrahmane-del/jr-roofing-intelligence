/** Issue #5: point-in-time attendance evidence validation. No continuous tracking. */
export type AttendanceFix = { latitude: number; longitude: number; accuracyMetres: number; capturedAt: string };
export type AttendanceSite = { latitude: number; longitude: number; radiusMetres: number };
export type AttendanceDecision = { status: "within" | "outside" | "uncertain"; distanceMetres: number; reason: string };
function validLatitude(n: number) { return Number.isFinite(n) && n >= -90 && n <= 90; }
function validLongitude(n: number) { return Number.isFinite(n) && n >= -180 && n <= 180; }
export function assessAttendanceFix(site: AttendanceSite, fix: AttendanceFix, now = Date.now()): AttendanceDecision {
  if (!validLatitude(site.latitude) || !validLongitude(site.longitude) || !validLatitude(fix.latitude) || !validLongitude(fix.longitude))
    throw new Error("Invalid geographic coordinates");
  if (!Number.isFinite(site.radiusMetres) || site.radiusMetres <= 0 || site.radiusMetres > 10000)
    throw new Error("Invalid site geofence radius");
  if (!Number.isFinite(fix.accuracyMetres) || fix.accuracyMetres < 0 || fix.accuracyMetres > 100000)
    throw new Error("Invalid GPS accuracy");
  const stamp = Date.parse(fix.capturedAt);
  if (!Number.isFinite(stamp) || !Number.isFinite(now) || stamp > now + 5000 || now - stamp > 120000)
    throw new Error("GPS evidence is stale or has an invalid timestamp");
  const rad = Math.PI / 180;
  const dLat = (fix.latitude - site.latitude) * rad;
  const dLon = (fix.longitude - site.longitude) * rad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(site.latitude * rad) * Math.cos(fix.latitude * rad) * Math.sin(dLon / 2) ** 2;
  const distanceMetres = 6371008.8 * 2 * Math.atan2(Math.sqrt(Math.min(1, a)), Math.sqrt(Math.max(0, 1 - a)));
  if (distanceMetres + fix.accuracyMetres <= site.radiusMetres)
    return { status: "within", distanceMetres, reason: "GPS uncertainty circle lies inside the site boundary; supervisor verification still required" };
  if (distanceMetres - fix.accuracyMetres > site.radiusMetres)
    return { status: "outside", distanceMetres, reason: "GPS uncertainty circle lies outside the site boundary" };
  return { status: "uncertain", distanceMetres, reason: "GPS accuracy overlaps the site boundary; manual verification required" };
}
