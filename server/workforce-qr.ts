import { createHash } from "node:crypto";
import type { Store } from "./store.ts";
import type { User } from "../src/model.ts";
import { redeemAttendanceChallenge } from "../src/workforce-qr.ts";
import { workforceAccess } from "./workforce.ts";

/** Atomic, durable QR redemption; does not itself create or approve attendance. */
export function redeemWorkforceQr(store: Store, actor: User, projectId: string, token: string, secret: Buffer, now = Date.now()): boolean {
  if (!["manager", "supervisor"].includes(actor.role)) throw Error("Forbidden: supervisor required");
  workforceAccess(store,actor,projectId);
  const tokenHash = createHash("sha256").update(token).digest("hex");
  return store.transaction(() => {
    const previous = store.db.prepare("SELECT token_hash FROM workforce_qr_redemptions WHERE token_hash=?").get(tokenHash);
    if (previous) return false;
    if (!redeemAttendanceChallenge(secret, token, projectId, new Set(), now)) return false;
    store.db.prepare("INSERT INTO workforce_qr_redemptions(token_hash,project_id,redeemed_by,redeemed_at) VALUES(?,?,?,?)")
      .run(tokenHash, projectId, actor.id, new Date(now).toISOString());
    store.audit(actor.id, "workforce.qr.redeem", { pid: projectId, tokenHash });
    return true;
  });
}
