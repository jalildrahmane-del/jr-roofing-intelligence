import { Workforce } from "./Workforce.tsx";
import React, { useEffect, useState, Component } from "react";
import { createRoot } from "react-dom/client";
import { routes, titles } from "./model.ts";
import type { Snapshot, User } from "./model.ts";
import "./style.css";
import { current } from "./tender.ts";
import { api, ApiError } from "./api.ts";
import { ApprovalWorkflow } from "./ApprovalWorkflow.tsx";
import { Workflow, Journey } from "./Workflow.tsx";
export function Form({
  fields,
  onSubmit,
  label = "Save record",
}: {
  fields: [string, string, string?][];
  onSubmit: (data: any) => Promise<void>;
  label?: string;
}) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const f = e.currentTarget;
        setBusy(true);
        setError("");
        try {
          await onSubmit(Object.fromEntries(new FormData(f)));
          f.reset();
        } catch (e) {
          setError((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="fields">
        {fields.map(([id, title, type = "text"]) => (
          <label key={id}>
            {title}
            {type === "textarea" ? (
              <textarea name={id} required />
            ) : (
              <input
                name={id}
                type={type}
                required
                step={type === "number" ? "any" : undefined}
              />
            )}
          </label>
        ))}
      </div>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <button disabled={busy}>{busy ? "Saving…" : label}</button>
    </form>
  );
}
class Boundary extends Component<
  { children: React.ReactNode },
  { error: string }
> {
  state = { error: "" };
  static getDerivedStateFromError(e: Error) {
    return { error: e.message };
  }
  render() {
    return this.state.error ? (
      <main>
        <h1>We couldn’t display this page</h1>
        <p>Your saved server records are retained.</p>
        <button onClick={() => location.reload()}>Reload workspace</button>
      </main>
    ) : (
      this.props.children
    );
  }
}
function App() {
  const [user, setUser] = useState<User | null>(null),
    [state, setState] = useState<Snapshot>({
      projects: [],
      records: [],
      revision: 0,
    }),
    [pid, setPid] = useState(""),
    [route, setRoute] = useState(location.hash.slice(1) || "dashboard"),
    [error, setError] = useState(""),
    [ready, setReady] = useState(false);
  async function refresh() {
    const s = await api("state");
    setState(s);
    setPid((p) =>
      s.projects.some((x: any) => x.id === p) ? p : s.projects[0]?.id || "",
    );
  }
  async function load() {
    setError("");
    try {
      setUser(await api("me"));
      await refresh();
    } catch (e) {
      if (!(e instanceof ApiError && e.status === 401))
        setError("Unable to load workspace: " + (e as Error).message);
      setUser(null);
    } finally {
      setReady(true);
    }
  }
  useEffect(() => {
    load();
    const listener = () => {
      setRoute(location.hash.slice(1) || "dashboard");
      setError("");
    };
    window.addEventListener("hashchange", listener);
    return () => window.removeEventListener("hashchange", listener);
  }, []);
  const project = state.projects.find((p) => p.id === pid);
  async function add(kind: string, data: any) {
    await api("records", { pid, kind, data });
    await refresh();
  }
  if (!ready) return <p role="status">Loading workspace…</p>;
  if (!user)
    return (
      <div className="login">
        <p className="eyebrow">JR ROOFING CONTRACTS</p>
        <h1>Roofing Intelligence</h1>
        <p>Local development workspace</p>
        {error && (
          <div role="alert" className="error">
            {error}
            <button onClick={() => void load()}>Retry connection</button>
          </div>
        )}
        <Form
          label="Sign in"
          fields={[
            ["name", "Username"],
            ["password", "Password", "password"],
          ]}
          onSubmit={async (d) => {
            await api("login", d);
            await load();
          }}
        />
        <a href="/legacy/">Open recovered V3.6 prototype</a>
      </div>
    );
  return (
    <>
      <header>
        <a href="#dashboard" className="brand">
          JR<span> / </span>ROOFING INTELLIGENCE
        </a>
        <span>
          {user.name} · {user.role}
        </span>
        <button
          className="quiet"
          onClick={async () => {
            try {
              await api("logout", {});
              setUser(null);
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        >
          Sign out
        </button>
      </header>
      <div className="shell">
        <aside>
          <nav aria-label="Workspace">
            {routes.map((r) => (
              <a
                aria-current={r === route ? "page" : undefined}
                href={"#" + r}
                key={r}
              >
                {titles[r]}
              </a>
            ))}
          </nav>
        </aside>
        <main>
          <div className="toolbar">
            <label>
              Active project
              <select
                aria-label="Active project"
                value={pid}
                onChange={(e) => setPid(e.target.value)}
              >
                <option value="">Select a project</option>
                {state.projects.map((p) => (
                  <option value={p.id} key={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <span className="tag">LOCAL · REVIEW BUILD</span>
          </div>
          <p className="eyebrow">From survey to handover</p>
          <h1>{titles[route] || "Page not found"}</h1>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          {route === "dashboard" && (
            <>
              <Journey records={state.records.filter((r) => r.pid === pid)} />
              <p>Evidence, costs and approvals in one project record.</p>
              <div className="stats">
                <article>
                  <small>Projects</small>
                  <strong>{state.projects.length}</strong>
                </article>
                <article>
                  <small>Project evidence records</small>
                  <strong>
                    {state.records.filter((r) => r.pid === pid).length}
                  </strong>
                </article>
                <article>
                  <small>
                    {current(
                      state.records.filter((r) => r.pid === pid),
                      "roof",
                    ).length
                      ? "Surveyed roof area"
                      : "Project roof area estimate"}
                  </small>
                  <strong>
                    {current(
                      state.records.filter((r) => r.pid === pid),
                      "roof",
                    ).length
                      ? current(
                          state.records.filter((r) => r.pid === pid),
                          "roof",
                        ).reduce((sum, r) => sum + r.data.area, 0)
                      : project?.area || 0}{" "}
                    m²
                  </strong>
                </article>
              </div>
              <section>
                <h2>{project?.name || "Create your first project"}</h2>
                <p>{project?.address}</p>
                <p>
                  Structural calculations remain preliminary until an authorised
                  engineer records approval.
                </p>
              </section>
            </>
          )}
          {route === "projects" && (
            <section>
              <h2>New project</h2>
              <Form
                label="Create project"
                fields={[
                  ["name", "Project name"],
                  ["client", "Client"],
                  ["address", "Site address"],
                  ["area", "Roof area (m²)", "number"],
                  ["type", "Sector"],
                  ["roof", "Roof type"],
                ]}
                onSubmit={async (d) => {
                  const p = await api("projects", d);
                  await refresh();
                  setPid(p.id);
                }}
              />
              <ul>
                {state.projects.map((p) => (
                  <li key={p.id}>
                    {p.name} · {p.client}
                  </li>
                ))}
              </ul>
            </section>
          )}
          {route === "legacy" && (
            <>
              <p>
                The recovered eight-section prototype retains its browser-local
                data and JSON export/import. It is separate from the server
                workspace.
              </p>
              <iframe title="V3.6 prototype" src="/legacy/" />
              <a href="/legacy/" target="_blank" rel="noreferrer">
                Open V3.6 in its own tab
              </a>
            </>
          )}
          {route === "structure" && !project && (
            <section>
              <p>
                Select or create a project to record a preliminary calculation.
              </p>
              <a href="#projects">Open Project Register</a>
            </section>
          )}
          {route === "structure" && project && (
            <section>
              <p className="warning">
                Preliminary dead-load arithmetic only. No structural adequacy or
                construction-stage authorisation.
              </p>
              <Form
                fields={[
                  ["thickness", "Thickness (mm)", "number"],
                  ["density", "Density (kg/m³)", "number"],
                  ["area", "Area (m²)", "number"],
                  ["other", "Other permanent load (kN/m²)", "number"],
                ]}
                onSubmit={(d) => add("load", d)}
              />
              <pre>
                {JSON.stringify(
                  state.records
                    .filter((r) => r.pid === pid && r.kind === "load")
                    .at(-1)?.data || {},
                  null,
                  2,
                )}
              </pre>
            </section>
          )}
          {!routes.includes(route as (typeof routes)[number]) && (
            <p>
              <a href="#dashboard">Return to dashboard</a>
            </p>
          )}
          {["survey", "materials", "estimating"].includes(route) && (
            <Workflow
              key={pid}
              route={route}
              pid={pid}
              project={project}
              records={state.records.filter((r) => r.pid === pid)}
              user={user}
              refresh={refresh}
            />
          )}
          {["design", "construction", "quality", "handover"].includes(
            route,
          ) && (
            <ApprovalWorkflow
              key={pid + route}
              route={route}
              pid={pid}
              project={project}
              records={state.records.filter((r) => r.pid === pid)}
              user={user}
              refresh={refresh}
            />
          )}
          {route === "workforce" && <Workforce key={pid} pid={pid} user={user} />}
          {![
            "dashboard",
            "projects",
            "legacy",
            "structure",
            "survey",
            "materials",
            "estimating",
            "design",
            "construction",
            "quality",
            "handover",
            "workforce",
          ].includes(route) && (
            <section>
              <p>
                This module is awaiting its issue implementation. The existing
                functionality is available in the V3.6 Original Workspace.
              </p>
            </section>
          )}
        </main>
      </div>
    </>
  );
}
createRoot(document.getElementById("root")!).render(
  <Boundary>
    <App />
  </Boundary>,
);
