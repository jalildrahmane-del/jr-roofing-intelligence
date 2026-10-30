import { createHash } from "node:crypto";
import type { Store } from "./store.ts";
import type { User, RecordItem } from "../src/model.ts";
import { text, positive } from "../src/model.ts";
import { assessAttendanceFix } from "../src/workforce-geofence.ts";
import {
  createAttendanceChallenge,
  redeemAttendanceChallenge,
} from "../src/workforce-qr.ts";

const actions = ["in", "break-start", "break-end", "out"];
export function workforceRecords(store: Store, pid: string): RecordItem[] {
  return store.db
    .prepare(
      "SELECT * FROM records WHERE pid=? AND kind LIKE 'workforce.%' ORDER BY seq",
    )
    .all(pid)
    .map((r: any) => ({
      id: r.id,
      pid: r.pid,
      kind: r.kind,
      author: r.author,
      createdAt: r.created_at,
      data: JSON.parse(r.data),
    }));
}
export function workforceAccess(store: Store, user: User, pid: string) {
  if (!store.db.prepare("SELECT id FROM projects WHERE id=?").get(pid))
    throw Error("Project not found");
  const records = workforceRecords(store, pid),
    config = records.filter((r) => r.kind === "workforce.config").at(-1);
  const allocations = records.filter((r) => r.kind === "workforce.allocation");
  const allocation = allocations
    .filter((r) => r.data.workerId === user.id)
    .at(-1);
  if (
    user.role !== "manager" &&
    !(
      user.role === "supervisor" && config?.data.supervisors.includes(user.id)
    ) &&
    !(user.role === "worker" && allocation?.data.active)
  )
    throw Error("Forbidden: workforce project allocation required");
  return { records, config, allocation };
}
export function workforceState(store: Store, user: User, pid: string) {
  const { records, config } = workforceAccess(store, user, pid);
  const visible =
    user.role === "worker"
      ? records.filter(
          (r) => r.data.workerId === user.id || r.kind === "workforce.config",
        )
      : records;
  const users =
    user.role === "manager"
      ? store.db
          .prepare("SELECT id,name,role,company FROM users ORDER BY name")
          .all()
      : [];
  const weekly: Record<string, any> = {};
  for (const r of visible.filter((r) => r.kind === "workforce.progress")) {
    const day = new Date(r.data.day + "T00:00:00Z");
    day.setUTCDate(day.getUTCDate() - ((day.getUTCDay() + 6) % 7));
    const week = day.toISOString().slice(0, 10),
      key = JSON.stringify([r.data.workerId, week, r.data.unit]);
    weekly[key] ??= {
      workerId: r.data.workerId,
      week,
      unit: r.data.unit,
      quantity: 0,
      status: "Reported quantities; not approved for payment",
    };
    weekly[key].quantity += r.data.quantity;
  }
  return {
    records: visible,
    users,
    config: config?.data,
    report: attendanceReport(visible),
    weekly: Object.values(weekly),
  };
}
export function attendanceReport(records: RecordItem[]) {
  const events = records.filter((r) => r.kind === "workforce.event");
  const reviews = records.filter((r) => r.kind === "workforce.review");
  const rows: any[] = [];
  for (const workerId of new Set(events.map((r) => r.data.workerId))) {
    let start: number | null = null,
      breakStart: number | null = null,
      breakMs = 0,
      verifiedMs = 0,
      pending = 0,
      lastStamp = -Infinity,
      rate = 0,
      amount = 0;
    const shifts: any[] = [];
    const exceptions: string[] = [];
    for (const e of events.filter((r) => r.data.workerId === workerId)) {
      const review = reviews.filter((r) => r.data.eventId === e.id).at(-1);
      if (!review || review.data.decision !== "accepted") {
        pending += !review ? 1 : 0;
        exceptions.push(`${e.id}: ${review?.data.decision || "pending"}`);
        start = null;
        breakStart = null;
        breakMs = 0;
        continue;
      }
      const stamp = Date.parse(review.data.correctedAt || e.createdAt);
      if (stamp < lastStamp) {
        exceptions.push(`${e.id}: non-chronological correction`);
        start = null;
        breakStart = null;
        breakMs = 0;
        continue;
      }
      lastStamp = stamp;
      if (e.data.event === "in" && start === null) {
        start = stamp;
        breakMs = 0;
        rate = Number(e.data.rate) || 0;
      } else if (
        e.data.event === "break-start" &&
        start !== null &&
        breakStart === null &&
        stamp >= start
      )
        breakStart = stamp;
      else if (
        e.data.event === "break-end" &&
        breakStart !== null &&
        stamp >= breakStart
      ) {
        breakMs += stamp - breakStart;
        breakStart = null;
      } else if (
        e.data.event === "out" &&
        start !== null &&
        breakStart === null &&
        stamp >= start &&
        stamp - start <= 24 * 3600000 &&
        stamp - start >= breakMs
      ) {
        const hours = (stamp - start - breakMs) / 3600000;
        amount += hours * rate;
        shifts.push({
          day: new Date(start).toISOString().slice(0, 10),
          hours,
          rate,
          amount: Math.round(hours * rate * 100) / 100,
        });
        verifiedMs += stamp - start - breakMs;
        start = null;
        breakMs = 0;
      } else {
        exceptions.push(`${e.id}: invalid sequence or duration`);
        start = null;
        breakStart = null;
        breakMs = 0;
      }
    }
    if (start !== null) exceptions.push("Open shift");
    rows.push({
      workerId,
      verifiedHours: verifiedMs / 3600000,
      amount: Math.round(amount * 100) / 100,
      shifts,
      pending,
      exceptions,
      paymentStatus: "Reconciliation only — not payment authorisation",
    });
  }
  return rows;
}
export function workforceCommand(
  store: Store,
  user: User,
  pid: string,
  action: string,
  d: any,
  key: Buffer,
) {
  if (!d || typeof d !== "object" || Array.isArray(d))
    throw Error("Workforce data required");
  return store.transaction(() => {
    const { records, config } = workforceAccess(store, user, pid);
    const manager = () => {
      if (user.role !== "manager") throw Error("Forbidden: manager required");
    };
    const supervisor = () => {
      if (!["manager", "supervisor"].includes(user.role))
        throw Error("Forbidden: supervisor required");
    };
    const append = (kind: string, data: any) =>
      store.append(user, pid, "workforce." + kind, data);
    const worker = (id: string) => {
      const u = store.db
        .prepare(
          "SELECT id,name,company FROM users WHERE id=? AND role='worker'",
        )
        .get(id);
      if (!u) throw Error("Registered worker required");
      return u;
    };
    const allocated = (id: string) => {
      worker(id);
      const a = records
        .filter(
          (r) => r.kind === "workforce.allocation" && r.data.workerId === id,
        )
        .at(-1);
      if (!a?.data.active) throw Error("Worker is not allocated");
      return a;
    };
    if (action === "config") {
      manager();
      if (d.syntheticOnly !== true)
        throw Error(
          "Real-person use is disabled pending owner privacy approval",
        );
      const site = {
        latitude: Number(d.latitude),
        longitude: Number(d.longitude),
        radiusMetres: positive(d.radiusMetres, "Radius"),
      };
      assessAttendanceFix(site, {
        ...site,
        accuracyMetres: 0,
        capturedAt: new Date().toISOString(),
      });
      if (
        !Array.isArray(d.supervisors) ||
        d.supervisors.some(
          (id: any) =>
            typeof id !== "string" ||
            !store.db
              .prepare("SELECT id FROM users WHERE id=? AND role='supervisor'")
              .get(id),
        )
      )
        throw Error("Registered supervisors required");
      return append("config", {
        ...site,
        supervisors: [...new Set(d.supervisors)],
        syntheticOnly: true,
        notice:
          "Fictional test records only. GPS is captured only when you submit an event; it is not proof of presence. Records require independent review.",
      });
    }
    if (!config) throw Error("Manager must configure a fictional site first");
    if (action === "allocation") {
      manager();
      worker(d.workerId);
      if (typeof d.active !== "boolean") throw Error("Active status required");
      return append("allocation", {
        workerId: d.workerId,
        active: d.active,
        shift: text(d.shift, "Shift", 200),
        rate: positive(d.rate, "Hourly rate", true),
      });
    }
    if (action === "challenge") {
      supervisor();
      allocated(d.workerId);
      if (!actions.includes(d.event)) throw Error("Invalid event");
      const scope = JSON.stringify([pid, d.workerId, d.event]);
      const c = createAttendanceChallenge(key, scope);
      store.audit(user.id, "workforce.challenge", {
        pid,
        workerId: d.workerId,
        event: d.event,
      });
      return c;
    }
    if (action === "event") {
      if (user.role !== "worker")
        throw Error("Forbidden: workers submit their own events");
      const assignment = allocated(user.id);
      if (!actions.includes(d.event)) throw Error("Invalid event");
      const requestId = text(d.requestId, "Submission identifier", 100);
      const existing = records.find(
        (r) =>
          r.kind === "workforce.event" &&
          r.author === user.id &&
          r.data.requestId === requestId,
      );
      if (existing) return existing;
      const last = records
        .filter(
          (r) => r.kind === "workforce.event" && r.data.workerId === user.id,
        )
        .at(-1)?.data.event;
      const next: Record<string, string[]> = {
        none: ["in"],
        in: ["break-start", "out"],
        "break-start": ["break-end"],
        "break-end": ["break-start", "out"],
        out: ["in"],
      };
      if (!(next[last || "none"] || []).includes(d.event))
        throw Error("Invalid check-in/break/check-out sequence");
      if (typeof d.offline !== "boolean") throw Error("Offline flag required");
      let gps: any = null,
        qrVerified = false;
      if (!d.offline) {
        gps = assessAttendanceFix(config.data as any, d.fix);
        if (gps.status === "outside")
          throw Error("GPS is outside the site boundary");
        const token = text(d.token, "Supervisor QR token", 2048),
          hash = createHash("sha256").update(token).digest("hex");
        if (
          store.db
            .prepare(
              "SELECT token_hash FROM workforce_qr_redemptions WHERE token_hash=?",
            )
            .get(hash) ||
          !redeemAttendanceChallenge(
            key,
            token,
            JSON.stringify([pid, user.id, d.event]),
            new Set(),
          )
        )
          throw Error("Invalid, expired or already used supervisor QR");
        store.db
          .prepare("INSERT INTO workforce_qr_redemptions VALUES(?,?,?,?)")
          .run(hash, pid, user.id, new Date().toISOString());
        qrVerified = true;
      }
      const capturedAt = text(d.capturedAt, "Device timestamp", 40);
      if (
        !Number.isFinite(Date.parse(capturedAt)) ||
        Date.parse(capturedAt) > Date.now() + 5000
      )
        throw Error("Invalid device timestamp");
      return append("event", {
        workerId: user.id,
        rate: assignment.data.rate,
        event: d.event,
        requestId,
        offline: d.offline,
        capturedAt,
        gps,
        fix: d.offline
          ? null
          : {
              latitude: d.fix.latitude,
              longitude: d.fix.longitude,
              accuracyMetres: d.fix.accuracyMetres,
              capturedAt: d.fix.capturedAt,
            },
        qrVerified,
        status: "pending",
        notice: "Device time is untrusted; createdAt is server receipt time",
      });
    }
    if (action === "review") {
      supervisor();
      const event = records.find(
        (r) => r.id === d.eventId && r.kind === "workforce.event",
      );
      if (!event) throw Error("Attendance event not found");
      if (event.author === user.id || event.data.workerId === user.id)
        throw Error("Forbidden: independent reviewer required");
      if (!["accepted", "rejected"].includes(d.decision))
        throw Error("Invalid review decision");
      let correctedAt = null;
      if (d.correctedAt) {
        correctedAt = text(d.correctedAt, "Corrected timestamp", 40);
        if (
          !Number.isFinite(Date.parse(correctedAt)) ||
          Date.parse(correctedAt) > Date.now()
        )
          throw Error("Invalid corrected timestamp");
      }
      if (event.data.offline && d.decision === "accepted" && !correctedAt)
        throw Error(
          "Offline acceptance requires an independently verified timestamp",
        );
      return append("review", {
        workerId: event.data.workerId,
        eventId: event.id,
        decision: d.decision,
        reason: text(d.reason, "Verification evidence and reason", 2000),
        correctedAt,
      });
    }
    if (action === "reconcile") {
      manager();
      const report = attendanceReport(records).find(
        (r) => r.workerId === d.workerId,
      );
      if (!report) throw Error("Attendance report not found");
      const claimedAmount = positive(d.claimedAmount, "Claimed amount", true);
      return append("reconciliation", {
        workerId: d.workerId,
        claimedAmount,
        report,
        variance: Math.round((claimedAmount - report.amount) * 100) / 100,
        note: text(d.note, "Reconciliation note", 2000),
        status: "Comparison recorded; not payment authorisation",
        reportHash: createHash("sha256")
          .update(JSON.stringify(report))
          .digest("hex"),
      });
    }
    if (action === "material-request") {
      if (!["worker", "supervisor", "manager"].includes(user.role))
        throw Error("Forbidden: workforce role required");
      const workerId = user.role === "worker" ? user.id : d.workerId;
      allocated(workerId);
      const neededBy = text(d.neededBy, "Required date", 10);
      if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(neededBy) ||
          !Number.isFinite(Date.parse(neededBy + "T00:00:00Z")))
        throw Error("Invalid required date");
      return append("material-request", {
        workerId,
        description: text(d.description, "Material description", 500),
        specification: text(d.specification, "Specification", 500),
        quantity: positive(d.quantity, "Quantity"),
        unit: text(d.unit, "Unit", 30),
        neededBy,
        deliveryPoint: text(d.deliveryPoint, "Delivery point", 300),
        reason: text(d.reason, "Reason for request", 1000),
        status: "pending supervisor review",
      });
    }
    if (action === "material-review") {
      supervisor();
      const request = records.find(r => r.id === d.requestId && r.kind === "workforce.material-request");
      if (!request) throw Error("Material request not found for this project");
      if (request.author === user.id) throw Error("Independent reviewer required");
      if (!["approved", "rejected"].includes(d.decision))
        throw Error("Invalid material review decision");
      if (records.some(r => r.kind === "workforce.material-review" && r.data.requestId === request.id))
        throw Error("Material request already reviewed");
      return append("material-review", {
        workerId: request.data.workerId,
        requestId: request.id,
        decision: d.decision,
        reason: text(d.reason, "Review reason", 1000),
        status: "Review recorded; procurement not confirmed",
      });
    }
    if (action === "progress") {
      const workerId = user.role === "worker" ? user.id : d.workerId;
      allocated(workerId);
      if (user.role !== "worker") supervisor();
      const day = text(d.day, "Work date", 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !Number.isFinite(Date.parse(day)))
        throw Error("Invalid work date");
      return append("progress", {
        workerId,
        day,
        quantity: positive(d.quantity, "Quantity", true),
        unit: text(d.unit, "Unit", 30),
        description: text(d.description, "Daily progress", 3000),
        evidence: text(d.evidence, "Evidence reference", 1000),
        status: "reported, not independently verified",
      });
    }
    throw Error("Unknown workforce action");
  });
}
