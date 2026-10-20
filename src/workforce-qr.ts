import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/** Issue #5: short-lived supervisor QR challenges. Requires server-side single-use redemption. */
export type AttendanceChallenge = { token: string; expiresAt: number };
export function createAttendanceChallenge(secret: Buffer, projectId: string, now = Date.now(), lifetimeMs = 60000): AttendanceChallenge {
  if (secret.length < 32) throw Error("QR signing key is too short");
  if (!projectId || projectId.length > 200) throw Error("Invalid project");
  if (!Number.isFinite(now) || !Number.isFinite(lifetimeMs) || lifetimeMs < 1000 || lifetimeMs > 120000)
    throw Error("Invalid challenge lifetime");
  const expiresAt = now + lifetimeMs;
  const payload = Buffer.from(JSON.stringify({ projectId, expiresAt, nonce: randomBytes(24).toString("hex") })).toString("base64url");
  const mac = createHmac("sha256", secret).update(payload).digest("base64url");
  return { token: payload + "." + mac, expiresAt };
}
export function redeemAttendanceChallenge(secret: Buffer, token: string, projectId: string, used: Set<string>, now = Date.now()): boolean {
  if (secret.length < 32 || !Number.isFinite(now) || typeof token !== "string" || token.length > 2048) return false;
  const pieces = token.split(".");
  if (pieces.length !== 2 || !pieces[0] || !pieces[1] || used.has(token)) return false;
  const expected = createHmac("sha256", secret).update(pieces[0]).digest();
  let provided: Buffer;
  try { provided = Buffer.from(pieces[1], "base64url"); } catch { return false; }
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) return false;
  try {
    const data = JSON.parse(Buffer.from(pieces[0], "base64url").toString("utf8"));
    if (data.projectId !== projectId || typeof data.nonce !== "string" || !/^[0-9a-f]{48}$/.test(data.nonce) ||
      !Number.isSafeInteger(data.expiresAt) || now > data.expiresAt || now < data.expiresAt - 120000) return false;
    used.add(token);
    return true;
  } catch { return false; }
}
