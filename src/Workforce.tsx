import React, { useState, useEffect } from "react";
import { api } from "./api.ts";
import type { User } from "./model.ts";
import QRCode from "qrcode";
import { ProductivityPanel } from "./ProductivityPanel.tsx";

export function Entry({
  title,
  fields,
  submit,
}: {
  title: string;
  fields: string[];
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
            {f}
            <input name={f} required />
          </label>
        ))}
      </div>
      {error && <p role="alert">{error}</p>}
      {success && <p role="status" className="success">{success}</p>}
      <button disabled={busy}>{busy ? "Saving…" : title}</button>
    </form>
  );
}
export function Workforce({ pid, user }: { pid: string; user: User }) {
  const [state, setState] = useState<any>(null),
    [error, setError] = useState(""),
    [challenge, setChallenge] = useState<any>(null),
    [qr, setQr] = useState(""),
    [confirmedProject, setConfirmedProject] = useState(false),
    [success, setSuccess] = useState("");
  const queueKey = "jr-workforce-queue:" + user.id + ":" + pid;
  const [queue, setQueue] = useState<any[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(queueKey) || "[]");
    } catch {
      return [];
    }
  });
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
      {error && <p role="alert">{error}</p>}
      {user.role === "manager" && (
        <section>
          <Entry
            title="Configure fictional site"
            fields={[
              "latitude",
              "longitude",
              "radiusMetres",
              "supervisor IDs (comma separated)",
            ]}
            submit={(d) =>
              send("config", {
                ...d,
                syntheticOnly: true,
                supervisors: d["supervisor IDs (comma separated)"]
                  .split(",")
                  .map((v: string) => v.trim())
                  .filter(Boolean),
              })
            }
          />
          <h3>Registered users</h3>
          <ul>
            {state?.users.map((u: any) => (
              <li key={u.id}>
                {u.name} · {u.company} · {u.role} · <code>{u.id}</code>
              </li>
            ))}
          </ul>
          <Entry
            title="Allocate worker"
            fields={["workerId", "shift", "rate"]}
            submit={(d) => send("allocation", { ...d, active: true })}
          />
          <Entry
            title="Remove worker allocation"
            fields={["workerId", "shift", "rate"]}
            submit={(d) => send("allocation", { ...d, active: false })}
          />
        </section>
      )}
      {["manager", "supervisor"].includes(user.role) && (
        <section>
          <Entry
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
          <p>Job reference: <strong>{pid}</strong>. Confirm this is the correct site before recording a GPS event. Your location is requested only when you submit an online event.</p>
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
          <p>{queue.length} unverified events held on this device.</p>
          <button
            disabled={busy || !queue.length}
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
      {state && (
        <>
          <section>
            <h2>Attendance review</h2>
            <ul>
              {state.records
                .filter((r: any) => r.kind === "workforce.event")
                .map((r: any) => (
                  <li key={r.id}>
                    <code>{r.id}</code> · {r.data.workerId} · {r.data.event} ·{" "}
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
          {["manager", "supervisor"].includes(user.role) && <ProductivityPanel state={state} />}
          <section>
            <h2>Weekly reported quantities</h2>
            <ul>
              {state.weekly?.map((r: any) => (
                <li key={r.workerId + r.week + r.unit}>
                  {r.week} · {r.workerId} · {r.quantity} {r.unit} · unverified
                </li>
              ))}
            </ul>
            <h2>Reconciliation report</h2>
            {user.role === "manager" && (
              <Entry
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
              <article key={r.workerId}>
                <h3>{r.workerId}</h3>
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
