import { readOfflineQueue } from "./workforce-queue.ts";
import React, { useState, useEffect } from "react";
import { api } from "./api.ts";
import type { User, Project } from "./model.ts";
import QRCode from "qrcode";
import { ProductivityPanel } from "./ProductivityPanel.tsx";
import { WorkforceComparison } from "./WorkforceComparison.tsx";

export function Entry({
  title,
  fields,
  users,
  submit,
}: {
  title: string;
  fields: string[];
  users?: any[];
  submit: (d: any) => Promise<void>;
}) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        try {
          await submit(Object.fromEntries(new FormData(e.currentTarget)));
        } catch (e) {
          setError((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <h3>{title}</h3>
      <div className="fields">
        {fields.map((f) => (
          <label key={f}>
            {f === "workerId" ? "Worker" : f.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, c => c.toUpperCase())}
            {f === "workerId" && users ? <select aria-label="Worker" name={f} required defaultValue=""><option value="">Select worker</option>{users.filter(u => u.role === "worker").map(u => <option key={u.id} value={u.id}>{u.name} — {u.company}</option>)}</select> : <input name={f} required />}
          </label>
        ))}
      </div>
      {error && <p role="alert">{error}</p>}
      <button disabled={busy}>{busy ? "Saving…" : title}</button>
    </form>
  );
}
function WorkforceWeather({ pid, project }: { pid: string; project?: Project }) {
  const [forecast, setForecast] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const load = async () => {
    setLoading(true);
    setError("");
    try { setForecast(await api("workforce-weather?pid=" + encodeURIComponent(pid))); }
    catch (e) { setForecast(null); setError((e as Error).message); }
    finally { setLoading(false); }
  };
  useEffect(() => {
    let active = true;
    setForecast(null);
    setError("");
    setLoading(true);
    api("workforce-weather?pid=" + encodeURIComponent(pid)).then((value: any) => { if (active) setForecast(value); }).catch((e: Error) => { if (active) setError(e.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [pid]);
  const show = (value: number | null | undefined, unit: string) => value == null ? "Unavailable" : value.toFixed(1) + unit;
  return <section className="workforce-weather" aria-labelledby="workforce-weather-heading">
    <h2 id="workforce-weather-heading">🌦️ Today's site weather forecast</h2>
    <p><strong>{project?.name || "Selected project"}</strong> · {project?.address || "Site address not recorded"}</p>
    <p>Forecast is based on the project's saved UK postcode, not your phone location.</p>
    <button type="button" disabled={loading} onClick={load}>{loading ? "Checking forecast…" : "Refresh forecast"}</button>
    {error && <p role="alert">{error}</p>}
    {forecast && <>
      <p><strong>{forecast.date}</strong> · postcode {forecast.postcode} · checked {new Date(forecast.updatedAt).toLocaleString("en-GB")}</p>
      <div className="fields" aria-label="Daily forecast summary">
        <p>🌡️ Temperature <strong>{show(forecast.temperatureMinC, "°C")} – {show(forecast.temperatureMaxC, "°C")}</strong></p>
        <p>🌧️ Rain <strong>{show(forecast.rainMm, " mm")}</strong> · probability {show(forecast.rainProbabilityPercent, "%")}</p>
        <p>💨 Wind <strong>{show(forecast.windMaxMph, " mph")}</strong> · gusts up to <strong>{show(forecast.gustMaxMph, " mph")}</strong></p>
      </div>
      {forecast.advisory?.length > 0 && <div className="warning"><strong>Planning considerations</strong><ul>{forecast.advisory.map((note: string) => <li key={note}>{note}</li>)}</ul></div>}
      <details><summary>Hourly site forecast (06:00–19:00 UK time)</summary>
        {forecast.hourly?.length ? <div style={{ overflowX: "auto" }}><table><thead><tr><th>Time</th><th>Temp</th><th>Rain chance</th><th>Rain</th><th>Wind</th><th>Gusts</th></tr></thead><tbody>
          {forecast.hourly.map((h: any) => <tr key={h.time}><td>{h.time.slice(11)}</td><td>{show(h.temperatureC, "°C")}</td><td>{show(h.rainProbabilityPercent, "%")}</td><td>{show(h.rainMm, " mm")}</td><td>{show(h.windMph, " mph")}</td><td>{show(h.gustMph, " mph")}</td></tr>)}
        </tbody></table></div> : <p>Hourly data unavailable.</p>}
      </details>
      <p className="warning">{forecast.notice}</p>
      <p><small>Source: {forecast.source}. This is a forecast, not a live weather measurement or a permit to work.</small></p>
    </>}
  </section>;
}
function workerName(state: any, id: string) {
  const person = state?.users?.find((u: any) => u.id === id);
  return person ? `${person.name} — ${person.company}` : "Worker";
}

function SiteSetup({ state, send }: { state: any; send: (action: string, data: any) => Promise<void> }) {
  const [fix, setFix] = useState<GeolocationPosition | null>(null);
  const [locating, setLocating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const locate = () => {
    setFix(null); setError(""); setMessage("");
    if (!navigator.geolocation) { setError("Location is unavailable on this device. Try a phone with location enabled."); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(position => {
      setFix(position); setLocating(false);
    }, err => {
      setLocating(false);
      setError(err.code === 1 ? "Location permission is blocked. Allow location for this site in your browser, then try again." : "Could not get your location. Check location services and try again, preferably on your phone outdoors.");
    }, { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 });
  };
  return <form onSubmit={async e => {
    e.preventDefault(); setError(""); setMessage("");
    if (!fix || Date.now() - fix.timestamp > 120000) { setError("Select Use my location to get a fresh location before saving."); return; }
    const data = new FormData(e.currentTarget);
    const radius = Number(data.get("radiusMetres"));
    if (fix.coords.accuracy > radius) { setError("Location accuracy is wider than the site radius. Get a more accurate fix before saving."); return; }
    setSaving(true);
    try {
      await send("config", { latitude: fix.coords.latitude, longitude: fix.coords.longitude, radiusMetres: radius, supervisors: data.getAll("supervisors"), syntheticOnly: true });
      setMessage("Site location saved.");
    } catch (err) { setError((err as Error).message); }
    finally { setSaving(false); }
  }}>
    <h3>Site location</h3>
    <p>Stand at the site sign-in point and use your device location to set the attendance area.</p>
    {state?.config && <p>A site location is already saved. It stays unchanged until you save a new location.</p>}
    <button type="button" disabled={locating || saving} onClick={locate}>{locating ? "Finding your location…" : "Use my location"}</button>
    {fix && <p role="status">Location found · accuracy ±{Math.round(fix.coords.accuracy)} metres. Confirm you are at the intended site before saving.</p>}
    <label>Site radius (metres)<input name="radiusMetres" type="number" min="1" required defaultValue={state?.config?.radiusMetres || 100} /></label>
    <fieldset><legend>Site supervisors</legend>
      {(state?.users || []).filter((u: any) => u.role === "supervisor").map((u: any) => <label key={u.id}><input type="checkbox" name="supervisors" value={u.id} defaultChecked={state?.config?.supervisors?.includes(u.id)} />{u.name} — {u.company}</label>)}
      {!(state?.users || []).some((u: any) => u.role === "supervisor") && <p>No supervisor accounts available yet.</p>}
    </fieldset>
    {error && <p role="alert">{error}</p>}{message && <p role="status">{message}</p>}
    <button type="submit" disabled={!fix || locating || saving}>{saving ? "Saving…" : "Save site location"}</button>
  </form>;
}

function ShiftPlanner({ state, user, send }: { state: any; user: User; send: (action: string, data: any) => Promise<void> }) {
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const editable = ["manager", "supervisor"].includes(user.role);
  const schedules: any[] = state.schedules || [];
  const active = schedules.filter((r) => !r.data.cancelled);
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    setError("");
    setSaving(true);
    try {
      const data = Object.fromEntries(new FormData(form));
      const replaces = String(data.replaces || "");
      if (data.action === "cancel-shift") {
        if (!replaces) throw Error("Select an existing shift to cancel.");
        await send("cancel-shift", { replaces, reason: data.reason });
      } else {
        const start = new Date(String(data.start));
        const end = new Date(String(data.end));
        if (!Number.isFinite(+start) || !Number.isFinite(+end)) throw Error("Valid shift dates and times are required.");
        await send("shift", {
          workerId: data.workerId,
          replaces: replaces || undefined,
          start: start.toISOString(),
          end: end.toISOString(),
          breakMinutes: Number(data.breakMinutes),
          reason: data.reason,
        });
      }
      form.reset();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };
  return <section aria-labelledby="shift-planner-heading" className="workforce-shifts">
    <h2 id="shift-planner-heading">Planned workforce shifts</h2>
    <p>Times are entered in your device's local time zone and saved as UTC. Plans are not verified attendance or payment authorisation.</p>
    {!schedules.length && <p>No shifts planned for this project.</p>}
    <ul>{schedules.map(r => <li key={r.id}>
      <strong>{workerName(state, r.data.workerId)}</strong> · {new Date(r.data.start).toLocaleString()} – {new Date(r.data.end).toLocaleString()} · {r.plannedHours.toFixed(2)} planned hours · {r.data.cancelled ? "Cancelled" : "Active"}
    </li>)}</ul>
    {editable && <form onSubmit={submit}>
      <h3>Create, revise or cancel a shift</h3>
      <div className="fields">
        <label>Action<select name="action" defaultValue="shift"><option value="shift">Create or revise</option><option value="cancel-shift">Cancel selected shift</option></select></label>
        <label>Worker<select aria-label="Worker" name="workerId" required><option value="">Select worker</option>{(state.users || []).filter((u: any) => u.role === "worker").map((u: any) => <option key={u.id} value={u.id}>{u.name} — {u.company}</option>)}</select></label>
        <label>Existing shift to revise or cancel<select name="replaces" defaultValue=""><option value="">New shift</option>{active.map(r => <option key={r.id} value={r.id}>{workerName(state, r.data.workerId)} — {new Date(r.data.start).toLocaleString()}</option>)}</select></label>
        <label>Start<input type="datetime-local" name="start" /></label>
        <label>Finish<input type="datetime-local" name="end" /></label>
        <label>Unpaid break (minutes)<input type="number" name="breakMinutes" min="0" step="1" defaultValue="30" /></label>
        <label>Reason<input name="reason" maxLength={500} required /></label>
      </div>
      {error && <p role="alert">{error}</p>}
      <button type="submit" disabled={saving}>{saving ? "Saving…" : "Save shift plan"}</button>
    </form>}
  </section>;
}
async function prepareDailyPhoto(file: File): Promise<string> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 20 * 1024 * 1024)
    throw Error("Choose a JPEG, PNG or WebP photograph under 20 MiB");
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, 1600 / bitmap.width, 1600 / bitmap.height);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw Error("Image processing unavailable");
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const result = canvas.toDataURL("image/jpeg", 0.7);
    if (result.length > 1400000) throw Error("Compressed photograph too large. Choose a smaller photograph.");
    return result;
  } finally {
    bitmap.close();
  }
}
export function Workforce(props: { pid: string; user: User; project?: Project }) {
  return <WorkforceSession key={JSON.stringify([props.user.id, props.pid])} {...props} />;
}
function WorkforceSession({ pid, user, project }: { pid: string; user: User; project?: Project }) {
  const [state, setState] = useState<any>(null),
    [error, setError] = useState(""),
    [challenge, setChallenge] = useState<any>(null),
    [qr, setQr] = useState(""),
    [siteQr, setSiteQr] = useState(""),
    [confirmedProject, setConfirmedProject] = useState(false),
    [success, setSuccess] = useState("");
  const [dailyPhotos, setDailyPhotos] = useState<{ image: string; caption: string }[]>([]);
  const [photoBusy, setPhotoBusy] = useState(false);
  const queueKey = "jr-workforce-queue:" + user.id + ":" + pid;
  const [initialQueue] = useState(() => {
    try { return {events: readOfflineQueue(localStorage.getItem(queueKey)), error: ""}; }
    catch { return {events: [], error: "Saved offline queue cannot be read. Stored data is preserved; do not clear browser storage."}; }
  });
  const [queue, setQueue] = useState<any[]>(initialQueue.events);
  const saveQueue = (q: any[]) => {
    localStorage.setItem(queueKey, JSON.stringify(q));
    setQueue(q);
  };
  const [token, setToken] = useState(""),
    [event, setEvent] = useState("in"),
    [busy, setBusy] = useState(false);
  const refresh = async () => {
    setState(await api("workforce?pid=" + encodeURIComponent(pid)));
  };
  useEffect(() => {
    setConfirmedProject(false);
    setSuccess("");
    setState(null);

    if (pid) refresh().catch((e) => setError(e.message));
  }, [pid]);
  // This QR is a project navigation link only, never a login or attendance token.
  // The server still requires authenticated, allocated workers and supervisor review.
  const siteLink = pid ? new URL(`?site=${encodeURIComponent(pid)}#workforce`, window.location.origin + "/").href : "";
  useEffect(() => {
    let active = true;
    setSiteQr("");
    if (pid && ["manager", "supervisor"].includes(user.role)) {
      QRCode.toDataURL(siteLink, { width: 560, margin: 3, errorCorrectionLevel: "H" })
        .then(data => { if (active) setSiteQr(data); })
        .catch(e => { if (active) setError("Unable to create site QR: " + e.message); });
    }
    return () => { active = false; };
  }, [pid, user.role]);
  const send = async (action: string, data: any) => {
    await api("workforce", { pid, action, data });
    await refresh();
  };
  async function checkIn(offline = false) {
    setError("");
    setSuccess("");
    if (!confirmedProject) {
      setError("Confirm the selected project before recording attendance.");
      return;
    }
    setBusy(true);
    try {
      if (offline) {
        if (initialQueue.error) throw Error(initialQueue.error);
        saveQueue([
          ...queue,
          {
            event,
            offline: true,
            capturedAt: new Date().toISOString(),
            requestId: crypto.randomUUID(),
          },
        ]);
        setSuccess("Unverified event queued on this device for later review. It is not a confirmed attendance record.");
        return;
      }
      let fix: any = null;
      if (!offline) {
        const p = await new Promise<GeolocationPosition>((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 0,
          }),
        );
        fix = {
          latitude: p.coords.latitude,
          longitude: p.coords.longitude,
          accuracyMetres: p.coords.accuracy,
          capturedAt: new Date(p.timestamp).toISOString(),
        };
      }
      await send("event", {
        event,
        token,
        fix,
        offline,
        capturedAt: new Date().toISOString(),
        requestId: crypto.randomUUID(),
      });
      setToken("");
      setSuccess("Attendance event received for independent review. GPS and QR are not proof of attendance.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (!pid) return <p>Select a project first.</p>;
  return (
    <>
      <p className="warning">
        Fictional test records only. GPS is captured only when submitting an
        event. All attendance needs independent review; no continuous tracking.
      </p>
      <WorkforceWeather pid={pid} project={project} />
      {error && <p role="alert">{error}</p>}
      {success && <p role="status" className="success">{success}</p>}
      {["manager", "supervisor"].includes(user.role) && (
        <section className="site-qr-section" aria-labelledby="site-qr-heading">
          <h2 id="site-qr-heading">Printable project sign-in QR</h2>
          <p>Print and display this project-specific notice at the site sign-in point. Scanning opens the correct project; it does <strong>not</strong> sign anybody in automatically.</p>
          <div className="site-qr-print" aria-label="Printable site QR notice">
            <div className="site-qr-brand">JR ROOFING CONTRACTS</div>
            <h2>WORKFORCE SITE SIGN-IN</h2>
            <h3>{project?.name || "Selected project"}</h3>
            <p>{project?.address || "Confirm the site address with your supervisor"}</p>
            {siteQr ? <img src={siteQr} alt={`QR code to open workforce sign-in for ${project?.name || "Selected project"}`} /> : <p>Generating QR code…</p>}
            <p className="site-qr-instructions"><strong>SCAN → SIGN IN → CONFIRM THIS JOB → RECORD ATTENDANCE</strong></p>
            <p>Use your individual worker account. GPS is requested when you submit an online attendance event. Supervisor review is required.</p>
            <small>Project: {project?.name || "Selected project"} · This QR is not proof of attendance and does not bypass login.</small>
          </div>
          <button type="button" disabled={!siteQr} onClick={() => window.print()}>Print A4 site QR notice</button>
          <p><small>For security, only managers and authorised supervisors can generate the notice. Workers still need project allocation and an authenticated account.</small></p>
        </section>
      )}
      {user.role === "manager" && (
        <section>
          <SiteSetup state={state} send={send} />
          <h3>Subcontractor owner access</h3>
          <p>Grant or revoke read-only access to a registered subcontractor owner for this project. The owner can see only their company's workforce.</p>
          <form onSubmit={async (e) => {
            e.preventDefault();
            const data = Object.fromEntries(new FormData(e.currentTarget));
            try { await send("owner", { ownerId: data.ownerId, active: data.active === "true" }); setSuccess("Owner permission updated."); setError(""); }
            catch (err) { setError((err as Error).message); }
          }}>
            <div className="fields">
              <label>Registered owner<select name="ownerId" required><option value="">Select owner</option>{(state?.users || []).filter((u: any) => u.role === "subcontractor-owner").map((u: any) => <option key={u.id} value={u.id}>{u.name} — {u.company}</option>)}</select></label>
              <label>Permission<select name="active"><option value="true">Grant access</option><option value="false">Revoke access</option></select></label>
            </div>
            <button type="submit">Update owner access</button>
          </form>
          <h3>Registered users</h3>
          <ul>
            {state?.users.map((u: any) => (
              <li key={u.id}>
                {u.name} · {u.company} · {u.role}
              </li>
            ))}
          </ul>
          <Entry
            users={state?.users || []}
            title="Allocate worker"
            fields={["workerId", "shift", "rate"]}
            submit={(d) => send("allocation", { ...d, active: true })}
          />
          <Entry
            users={state?.users || []}
            title="Remove worker allocation"
            fields={["workerId", "shift", "rate"]}
            submit={(d) => send("allocation", { ...d, active: false })}
          />
        </section>
      )}
      {["manager", "supervisor"].includes(user.role) && (
        <section>
          <Entry
            users={state?.users || []}
            title="Issue supervisor QR"
            fields={["workerId", "event"]}
            submit={async (d) => {
              const c = await api("workforce", {
                pid,
                action: "challenge",
                data: d,
              });
              setChallenge(c);
              setQr(await QRCode.toDataURL(c.token));
            }}
          />
          <p>
            Event: in, break-start, break-end or out. Each QR is bound to one
            worker and event and expires after 60 seconds.
          </p>
          {challenge && (
            <div>
              <img src={qr} alt="Single-use supervisor attendance QR" />
              <p>
                Expires {new Date(challenge.expiresAt).toLocaleTimeString()}
              </p>
              <textarea
                aria-label="Supervisor token"
                readOnly
                value={challenge.token}
              />
            </div>
          )}
        </section>
      )}
      {user.role === "worker" && (
        <section>
          <h2>My attendance — selected job</h2>
          <p>Job: <strong>{project?.name || "Selected project"}</strong>. Confirm this is the correct site before recording a GPS event. Your location is requested only when you submit an online event.</p>
          <label className="workforce-project-confirm">
            <input type="checkbox" checked={confirmedProject} onChange={e => setConfirmedProject(e.target.checked)} />
            I confirm I am recording attendance for this selected project.
          </label>
          <label>
            Event
            <select
              aria-label="Event"
              value={event}
              onChange={(e) => setEvent(e.target.value)}
            >
              {["in", "break-start", "break-end", "out"].map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </label>
          <label>
            Supervisor QR token
            <input value={token} onChange={(e) => setToken(e.target.value)} />
          </label>
          <label>
            Read QR image
            <input
              type="file"
              accept="image/*"
              onChange={async (e) => {
                try {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const Detector = (window as any).BarcodeDetector;
                  if (!Detector)
                    throw Error(
                      "QR image reading is unavailable in this browser. Copy the supervisor token instead.",
                    );
                  const bitmap = await createImageBitmap(file);
                  try {
                    const results = await new Detector({
                      formats: ["qr_code"],
                    }).detect(bitmap);
                    if (!results[0]) throw Error("No QR found");
                    setToken(results[0].rawValue);
                  } finally {
                    bitmap.close();
                  }
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            />
          </label>
          <button disabled={busy || !confirmedProject} onClick={() => checkIn()}>
            Submit GPS event for review
          </button>
          <button disabled={busy || !confirmedProject} onClick={() => checkIn(true)}>
            Queue unverified event offline
          </button>
          {initialQueue.error && <p role="alert">{initialQueue.error}</p>}
          <p>{queue.length} unverified events held on this device.</p>
          <button
            disabled={busy || !!initialQueue.error || !queue.length}
            onClick={async () => {
              setBusy(true);
              setError("");
              let remaining = [...queue];
              try {
                while (remaining.length) {
                  await send("event", remaining[0]);
                  remaining = remaining.slice(1);
                  saveQueue(remaining);
                }
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            Sync pending offline events
          </button>
          <p>
            Unverified records use server receipt time until a supervisor
            verifies the actual event time.
          </p>
        </section>
      )}
      {state && user.role === "subcontractor-owner" && (
        <section aria-label="Company workforce overview">
          <h2>My company workforce — read only</h2>
          <p>Only authorised project records for your company are shown. Exact GPS coordinates, other companies' records and editing controls are unavailable.</p>
          <ShiftPlanner state={state} user={user} send={send} />
          <WorkforceComparison state={state} user={user} send={send}/>
          <h3>Verified attendance summary</h3>
          {!state.report?.length && <p>No reviewed attendance records for your company.</p>}
          {(state.report || []).map((r: any) => <p key={workerName(state, r.workerId)}>{workerName(state, r.workerId)}: {r.verifiedHours.toFixed(2)} verified hours · {r.pending} pending. Reconciliation only, not payment approval.</p>)}
        </section>
      )}
      {state && user.role !== "subcontractor-owner" && (
        <>
          <ShiftPlanner state={state} user={user} send={send} />
          <WorkforceComparison state={state} user={user} send={send}/>
          <section>
            <h2>Attendance review</h2>
            <ul>
              {state.records
                .filter((r: any) => r.kind === "workforce.event")
                .map((r: any) => (
                  <li key={r.id}>
                    {workerName(state, r.data.workerId)} · {r.data.event} ·{" "}
                    {r.createdAt} ·{" "}
                    {state.records
                      .filter(
                        (v: any) =>
                          v.kind === "workforce.review" &&
                          v.data.eventId === r.id,
                      )
                      .at(-1)?.data.decision || "pending"}{" "}
                    {r.data.offline ? "· unverified device event" : ""}
                  </li>
                ))}
            </ul>
            {["manager", "supervisor"].includes(user.role) && (
              <Entry
            users={state?.users || []}
                title="Record independent review"
                fields={[
                  "eventId",
                  "decision",
                  "reason",
                  "correctedAt (ISO timestamp or none)",
                ]}
                submit={(d) =>
                  send("review", {
                    ...d,
                    correctedAt:
                      d["correctedAt (ISO timestamp or none)"] === "none"
                        ? null
                        : d["correctedAt (ISO timestamp or none)"],
                  })
                }
              />
            )}
          </section>
          <section>
            <Entry
            users={state?.users || []}
              title="Record daily progress"
              fields={[
                ...(user.role === "worker" ? [] : ["workerId"]),
                "day",
                "quantity",
                "unit",
                "description",
                "evidence",
              ]}
              submit={(d) => send("progress", d)}
            />
            <h3>Daily quantity evidence</h3>
            <ul>
              {state.records
                .filter((r: any) => r.kind === "workforce.progress")
                .map((r: any) => (
                  <li key={r.id}>
                    {r.data.day} · {r.data.quantity} {r.data.unit} ·{" "}
                    {r.data.description} · {r.data.evidence} · {r.data.status}
                  </li>
                ))}
            </ul>
          </section>
          <section className="workforce-daily" aria-labelledby="workforce-daily-heading">
            <h2 id="workforce-daily-heading">Daily site report with photographs</h2>
            <p>Record work completed on this project. Photos are stored as project evidence; submitting does not constitute supervisor approval.</p>
            <form onSubmit={async e => {
              e.preventDefault();
              const form = e.currentTarget;
              const d = Object.fromEntries(new FormData(form));
              setError("");
              setSuccess("");
              setBusy(true);
              try {
                if (!dailyPhotos.length) throw Error("Add at least one site photograph");
                await send("daily-report", { ...d, photos: dailyPhotos });
                setDailyPhotos([]);
                form.reset();
                setSuccess("Daily report and photographs submitted for supervisor review.");
              } catch (e) { setError((e as Error).message); }
              finally { setBusy(false); }
            }}>
              <div className="fields">
                {user.role !== "worker" && <label>Worker<select aria-label="Worker" name="workerId" required defaultValue=""><option value="">Select worker</option>{(state?.users || []).filter((u: any) => u.role === "worker").map((u: any) => <option key={u.id} value={u.id}>{u.name} — {u.company}</option>)}</select></label>}
                <label>Work date<input type="date" name="day" required defaultValue={new Date().toLocaleDateString("en-CA")} /></label>
                <label>Works completed<textarea name="completed" maxLength={3000} required /></label>
                <label>Delays or restrictions (write 'None' if applicable)<textarea name="delays" maxLength={2000} required /></label>
                <label>Plan for next shift<textarea name="nextShift" maxLength={2000} required /></label>
              </div>
              <label>Site photographs (1–4)
                <input type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={photoBusy || busy}
                  onChange={async e => {
                    const input = e.currentTarget;
                    const files = Array.from(input.files || []);
                    if (!files.length) return;
                    setPhotoBusy(true);
                    setError("");
                    try {
                      if (files.length + dailyPhotos.length > 4) throw Error("Maximum four photographs per report");
                      const prepared = await Promise.all(files.map(async file => ({
                        image: await prepareDailyPhoto(file),
                        caption: file.name.slice(0, 300) || "Site photograph",
                      })));
                      setDailyPhotos(previous => [...previous, ...prepared]);
                    } catch (e) { setError((e as Error).message); }
                    finally { setPhotoBusy(false); input.value = ""; }
                  }} />
              </label>
              <div className="workforce-photo-grid">
                {dailyPhotos.map((photo, i) => <div key={i}>
                  <img src={photo.image} alt={`Photo ${i + 1} preview`} />
                  <label>Photo {i + 1} caption<input value={photo.caption} maxLength={300} required
                    onChange={e => setDailyPhotos(current => current.map((p, n) => n === i ? { ...p, caption: e.target.value } : p))} /></label>
                  <button type="button" className="quiet" onClick={() => setDailyPhotos(current => current.filter((_, n) => n !== i))}>Remove photo</button>
                </div>)}
              </div>
              <button type="submit" disabled={busy || photoBusy || dailyPhotos.length === 0}>{busy ? "Submitting…" : "Submit daily report"}</button>
            </form>
            <h3>Submitted daily reports</h3>
            {state.records.filter((r: any) => r.kind === "workforce.daily-report").map((r: any) => {
              const review = state.records.find((v: any) => v.kind === "workforce.daily-review" && v.data.reportId === r.id);
              return <article className="workforce-report-card" key={r.id}>
                <strong>{r.data.day} · {workerName(state, r.data.workerId)}</strong>
                <p>{r.data.completed}</p>
                <p>Delays: {r.data.delays}</p>
                <p>Next shift: {r.data.nextShift}</p>
                <p>{review ? `Supervisor: ${review.data.decision}` : "Awaiting supervisor review"}</p>
                <div className="workforce-photo-grid">{r.data.evidence.map((photo: any) =>
                  <figure key={photo.assetId}><img loading="lazy" src={"/api/evidence/" + photo.assetId} alt={photo.caption} /><figcaption>{photo.caption}</figcaption></figure>
                )}</div>

              </article>;
            })}
            {["manager", "supervisor"].includes(user.role) && <Entry title="Review daily report" fields={["reportId", "decision", "reason"]} submit={d => send("daily-review", d)} />}
          </section>
          <section className="workforce-materials" aria-labelledby="workforce-materials-heading">
            <h2 id="workforce-materials-heading">Materials needed on this job</h2>
            <p>Request materials for the selected project. Submitting a request does not place an order.</p>
            <Entry
            users={state?.users || []}
              title="Submit materials request"
              fields={[
                ...(user.role === "worker" ? [] : ["workerId"]),
                "description", "specification", "quantity", "unit",
                "neededBy", "deliveryPoint", "reason",
              ]}
              submit={(d) => send("material-request", d)}
            />
            <h3>Project materials requests</h3>
            {!state.records.some((r: any) => r.kind === "workforce.material-request") && <p>No materials requests recorded yet.</p>}
            <ul>
              {state.records.filter((r: any) => r.kind === "workforce.material-request").map((r: any) => {
                const review = state.records.find((v: any) => v.kind === "workforce.material-review" && v.data.requestId === r.id);
                return <li key={r.id}>
                  <strong>{r.data.description}</strong> · {r.data.quantity} {r.data.unit} · needed {r.data.neededBy}
                  <br />{r.data.specification} · {r.data.deliveryPoint}
                  <br />{review ? `Supervisor: ${review.data.decision}` : "Awaiting supervisor review"}

                </li>;
              })}
            </ul>
            {["manager", "supervisor"].includes(user.role) && (
              <Entry
            users={state?.users || []}
                title="Review materials request"
                fields={["requestId", "decision", "reason"]}
                submit={(d) => send("material-review", d)}
              />
            )}
            <p className="warning">Supervisor approval is not a purchase order. Ordering, delivery and receipt confirmation are separate controls.</p>
          </section>
          {["manager", "supervisor"].includes(user.role) && <ProductivityPanel state={state} />}
          <section>
            <h2>Weekly reported quantities</h2>
            <ul>
              {state.weekly?.map((r: any) => (
                <li key={r.workerId + r.week + r.unit}>
                  {r.week} · {workerName(state, r.workerId)} · {r.quantity} {r.unit} · unverified
                </li>
              ))}
            </ul>
            <h2>Reconciliation report</h2>
            {user.role === "manager" && (
              <Entry
            users={state?.users || []}
                title="Record payment comparison"
                fields={["workerId", "claimedAmount", "note"]}
                submit={(d) => send("reconcile", d)}
              />
            )}
            <p>
              Only independently accepted complete shifts count. Pending,
              rejected or broken sequences are excluded. This is not payment
              approval.
            </p>
            {state.report.map((r: any) => (
              <article key={workerName(state, r.workerId)}>
                <h3>{workerName(state, r.workerId)}</h3>
                <p>
                  £{r.amount.toFixed(2)} at recorded rates ·{" "}
                  {r.verifiedHours.toFixed(2)} verified hours · {r.pending}{" "}
                  pending
                </p>
                <ul>
                  {r.exceptions.map((e: string) => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
              </article>
            ))}
            <button
              onClick={() => {
                const blob = new Blob(
                  [
                    JSON.stringify(
                      { exportedAt: new Date().toISOString(), ...state },
                      null,
                      2,
                    ),
                  ],
                  { type: "application/json" },
                );
                const url = URL.createObjectURL(blob),
                  a = document.createElement("a");
                a.href = url;
                a.download = "workforce-report.json";
                a.click();
                URL.revokeObjectURL(url);
              }}
            >
              Download records and report
            </button>
          </section>
        </>
      )}
    </>
  );
}
