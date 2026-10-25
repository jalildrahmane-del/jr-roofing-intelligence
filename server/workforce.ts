import { createHash } from "node:crypto";
import type { Store } from "./store.ts";
import type { User, RecordItem } from "../src/model.ts";
import { text, positive } from "../src/model.ts";
import { assessAttendanceFix } from "../src/workforce-geofence.ts";
import {
  createAttendanceChallenge,
  redeemAttendanceChallenge,
} from "../src/workforce-qr.ts";

import { latestShifts, shiftTime } from "./workforce-shifts.ts";

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
    !(user.role === "worker" && allocation?.data.active) &&
    !(
      user.role === "subcontractor-owner" &&
      records
        .filter(
          (r) => r.kind === "workforce.owner" && r.data.ownerId === user.id,
        )
        .at(-1)?.data.active === true &&
      records
        .filter(
          (r) => r.kind === "workforce.owner" && r.data.ownerId === user.id,
        )
        .at(-1)?.data.company === user.company
    )
  )
    throw Error("Forbidden: workforce project allocation required");
  return { records, config, allocation };
}
export function workforceState(store: Store, user: User, pid: string) {
  const { records, config } = workforceAccess(store, user, pid);
  let visible =
    user.role === "worker"
      ? records.filter(
          (r) => r.data.workerId === user.id || r.kind === "workforce.config",
        )
      : records;
  if (user.role === "subcontractor-owner") {
    const workers = new Set(
      store.db
        .prepare("SELECT id FROM users WHERE company=? AND role='worker'")
        .all(user.company)
        .map((r) => String(r.id)),
    );
    visible = records
      .filter((r) => workers.has(r.data.workerId))
      .map((r) => {
        if (r.kind !== "workforce.event") return r;
        const { fix, gps, ...data } = r.data;
        return {
          ...r,
          data: { ...data, gpsStatus: gps?.status || "unverified" },
        };
      });
  }
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
    config:
      user.role === "subcontractor-owner"
        ? { syntheticOnly: true, notice: config?.data.notice }
        : config?.data,
    schedules: latestShifts(visible).map((r) => ({
      ...r,
      plannedHours: r.data.cancelled
        ? 0
        : (Date.parse(r.data.end) - Date.parse(r.data.start)) / 3600000 -
          r.data.breakMinutes / 60,
    })),
    report: attendanceReport(visible),
    weekly: Object.values(weekly),
    exceptions: attendanceReport(visible).flatMap((r) =>
      r.exceptions.map((message: string) => ({
        workerId: r.workerId,
        message,
      })),
    ),
    reconciliations: visible
      .filter((r) => r.kind === "workforce.reconciliation")
      .map((r) => ({
        ...r,
        current:
          r.data.reportHash ===
          createHash("sha256")
            .update(
              JSON.stringify(
                attendanceReport(visible).find(
                  (row) => row.workerId === r.data.workerId,
                ),
              ),
            )
            .digest("hex"),
      })),
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
        const shiftPence = Math.round(hours * rate * 100);
        amount += shiftPence;
        shifts.push({
          start: new Date(start).toISOString(),
          end: new Date(stamp).toISOString(),
          breakMinutes: breakMs / 60000,
          day: new Date(start).toISOString().slice(0, 10),
          hours,
          rate,
          amount: shiftPence / 100,
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
      amount: amount / 100,
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
    if (action === "owner") {
      manager();
      const owner = store.db
        .prepare(
          "SELECT id,company FROM users WHERE id=? AND role='subcontractor-owner'",
        )
        .get(d.ownerId);
      if (!owner || typeof d.active !== "boolean")
        throw Error(
          "Registered subcontractor owner and active status required",
        );
      return append("owner", {
        ownerId: owner.id,
        company: owner.company,
        active: d.active,
      });
    }
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
    if (action === "shift" || action === "cancel-shift") {
      supervisor();
      const previous = d.replaces
        ? latestShifts(records).find((r) => r.id === d.replaces)
        : undefined;
      if (d.replaces && (!previous || previous.data.cancelled))
        throw Error("Shift revision is stale or cancelled");
      if (action === "cancel-shift") {
        if (!previous) throw Error("Current shift revision required");
        return append("shift", {
          ...previous.data,
          shiftId: previous.data.shiftId || previous.id,
          replaces: previous.id,
          cancelled: true,
          reason: text(d.reason, "Cancellation reason", 500),
        });
      }
      allocated(d.workerId);
      if (previous && previous.data.workerId !== d.workerId)
        throw Error("Cannot change shift worker");
      const start = shiftTime(d.start),
        end = shiftTime(d.end);
      const duration = Date.parse(end) - Date.parse(start);
      const breakMinutes = Number(d.breakMinutes);
      if (
        duration <= 0 ||
        duration > 86400000 ||
        !Number.isInteger(breakMinutes) ||
        breakMinutes < 0 ||
        breakMinutes * 60000 >= duration
      )
        throw Error(
          "Shift must last up to 24 hours with a shorter nonnegative whole-minute break",
        );
      const all = store.db
        .prepare(
          "SELECT id,pid,data FROM records WHERE kind='workforce.shift' ORDER BY seq",
        )
        .all()
        .map((r: any) => ({
          ...r,
          kind: "workforce.shift",
          data: JSON.parse(r.data),
        })) as RecordItem[];
      const shiftId = previous?.data.shiftId || previous?.id;
      if (
        latestShifts(all).some(
          (r) =>
            !r.data.cancelled &&
            r.data.workerId === d.workerId &&
            (r.data.shiftId || r.id) !== shiftId &&
            Date.parse(r.data.start) < Date.parse(end) &&
            Date.parse(r.data.end) > Date.parse(start),
        )
      )
        throw Error("Worker already has an overlapping shift");
      return append("shift", {
        workerId: d.workerId,
        shiftId: shiftId || null,
        replaces: previous?.id || null,
        start,
        end,
        breakMinutes,
        cancelled: false,
        reason: text(d.reason, "Shift description or revision reason", 500),
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
      if (existing) {
        if (
          existing.data.event !== d.event ||
          existing.data.offline !== d.offline ||
          existing.data.capturedAt !== d.capturedAt
        )
          throw Error(
            "Submission identifier already belongs to a different event",
          );
        return existing;
      }
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
      if (
        !d.offline &&
        (!d.fix || typeof d.fix !== "object" || Array.isArray(d.fix))
      )
        throw Error("GPS fix required");
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
    if (action === "progress") {
      const workerId = user.role === "worker" ? user.id : d.workerId;
      allocated(workerId);
      if (user.role !== "worker") supervisor();
      const day = text(d.day, "Work date", 10);
      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(day) ||
        !Number.isFinite(Date.parse(day)) ||
        new Date(day).toISOString().slice(0, 10) !== day
      )
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
