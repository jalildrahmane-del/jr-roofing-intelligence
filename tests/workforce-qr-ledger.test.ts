import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { Store } from "../server/store.ts";
import { redeemWorkforceQr } from "../server/workforce-qr.ts";
import { createAttendanceChallenge } from "../src/workforce-qr.ts";
import { workforceCommand } from "../server/workforce.ts";
test("QR redemption is durable in SQLite and only supervisor/manager can redeem", () => {
  const store = new Store(":memory:");
  try {
    const id = store.addUser("supervisor", "test-password-12345", "supervisor");
    const workerId = store.addUser("worker", "test-password-12345", "worker");
    const managerId = store.addUser("manager", "test-password-12345", "manager");
    const supervisor = { id, name:"supervisor", role:"supervisor" as const, company:"JR Roofing" };
    const worker = { id:workerId, name:"worker", role:"worker" as const, company:"JR Roofing" };
    const manager = { id:managerId, name:"manager", role:"manager" as const, company:"JR Roofing" };
    const project = store.project(manager, {name:"Fictional roof"});
    const key = randomBytes(32), now=Date.now(), challenge=createAttendanceChallenge(key,project.id,now);
    workforceCommand(store,manager,project.id,"config",{latitude:51,longitude:0,radiusMetres:100,supervisors:[supervisor.id],syntheticOnly:true},key);
    assert.throws(() => redeemWorkforceQr(store,worker,project.id,challenge.token,key,now),/Forbidden/);
    assert.equal(redeemWorkforceQr(store,supervisor,project.id,challenge.token,key,now),true);
    assert.equal(redeemWorkforceQr(store,supervisor,project.id,challenge.token,key,now),false);
    assert.equal(Number((store.db.prepare("SELECT count(*) n FROM workforce_qr_redemptions").get() as any).n),1);
    assert.equal(Number((store.db.prepare("SELECT count(*) n FROM audit WHERE action='workforce.qr.redeem'").get() as any).n),1);
  } finally { store.close(); }
});
