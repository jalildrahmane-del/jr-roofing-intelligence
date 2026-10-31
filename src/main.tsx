import { Documents } from "./Documents.tsx";
import { Workforce } from "./Workforce.tsx";
import React, { useEffect, useState, Component } from "react";
import { createRoot } from "react-dom/client";
import { routes, titles } from "./model.ts";
import type { Snapshot, User } from "./model.ts";
import "./style.css";
import { api, ApiError } from "./api.ts";
import { ApprovalWorkflow } from "./ApprovalWorkflow.tsx";
import { Workflow } from "./Workflow.tsx";
import { OwnerDashboard } from "./OwnerDashboard.tsx";
import { CommercialControl } from "./CommercialControl.tsx";
import { ProjectAccess } from "./ProjectAccess.tsx";
import "./owner-dashboard.css";
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
    setPid((p) => {
      const site = new URLSearchParams(location.search).get("site");
      if (p && s.projects.some((x: any) => x.id === p)) return p;
      if (site && s.projects.some((x: any) => x.id === site)) return site;
      return s.projects[0]?.id || "";
    });
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
  const workforceOnly = user?.role === "subcontractor-owner" || state.permissions?.[pid] === "workforce";
  const visibleRoute = workforceOnly ? "workforce" : route;
  const readOnly = state.permissions?.[pid] === "read";
  const projectUser = user && readOnly ? {...user,role:"viewer" as const} : user;
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
              setState({projects:[],records:[],revision:0});
              setPid("");
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
            {(workforceOnly ? ["workforce"] : routes).map((r) => (
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
          <h1>{titles[visibleRoute] || "Page not found"}</h1>
          {readOnly&&<p className="warning">Read-only project assignment. Editing requires a manager to change your permission.</p>}
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          {visibleRoute === "dashboard" && <OwnerDashboard snapshot={state} project={project} pid={pid} onSelectProject={setPid} isDirector={user.role === "manager"} />}
          {visibleRoute === "projects" && (
            <section>
              <h2>Existing projects</h2>
              {state.projects.length === 0 ? (
                <p>{user.role === "manager"?"No projects have been created yet.":"No projects are assigned to this account."}</p>
              ) : (
                <>
                  <p>Select a project to inspect its saved details. The register is read-only until a reviewed edit workflow is available.</p>
                  <ul>
                    {state.projects.map((p) => (
                      <li key={p.id}>
                        <button
                          type="button"
                          className="quiet"
                          aria-pressed={pid === p.id}
                          onClick={() => setPid(p.id)}
                        >
                          {p.name} · {p.client}{pid === p.id ? " (selected)" : ""}
                        </button>
                      </li>
                    ))}
                  </ul>
                  {project && (
                    <section aria-label="Selected project details">
                      <h3>{project.name} — saved project details</h3>
                      <dl className="project-details">
                        <div><dt>Project name</dt><dd>{project.name}</dd></div>
                        <div><dt>Client</dt><dd>{project.client || "Not recorded"}</dd></div>
                        <div><dt>Site address</dt><dd>{project.address || "Not recorded"}</dd></div>
                        <div><dt>Roof area</dt><dd>{project.area ? `${project.area.toLocaleString()} m²` : "Not recorded"}</dd></div>
                        <div><dt>Sector</dt><dd>{project.type || "Not recorded"}</dd></div>
                        <div><dt>Roof type</dt><dd>{project.roof || "Not recorded"}</dd></div>
                        <div><dt>Status</dt><dd>{project.status || "Not recorded"}</dd></div>
                      </dl>
                      <p>These values come from the saved project record. Survey reports in the V3.6 Original Workspace are stored separately and are not automatically linked to this record.</p>
                    </section>
                  )}
                </>
              )}
              {user.role === "manager" && project&&<ProjectAccess key={pid} pid={pid} refresh={refresh}/>}
              {user.role === "manager" && <h2>New project</h2>}
              {user.role === "manager" && <Form
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
              />}
            </section>
          )}
          {visibleRoute === "commercial" && <CommercialControl pid={pid} records={state.records.filter(r=>r.pid===pid)} user={user} refresh={refresh} />}
          {visibleRoute === "legacy" && (
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
          {visibleRoute === "structure" && !project && (
            <section>
              <p>
                Select or create a project to record a preliminary calculation.
              </p>
              <a href="#projects">Open Project Register</a>
            </section>
          )}
          {visibleRoute === "structure" && project && (
            <section>
              <p className="warning">
                Preliminary dead-load arithmetic only. No structural adequacy or
                construction-stage authorisation.
              </p>
              {!readOnly&&<Form
                fields={[
                  ["thickness", "Thickness (mm)", "number"],
                  ["density", "Density (kg/m³)", "number"],
                  ["area", "Area (m²)", "number"],
                  ["other", "Other permanent load (kN/m²)", "number"],
                ]}
                onSubmit={(d) => add("load", d)}
              />}
              {(() => {
                const result = state.records.filter(r => r.pid === pid && r.kind === "load").at(-1)?.data;
                if (!result) return <p>No calculation saved for this project yet.</p>;
                return <section aria-label="Latest structural screening result"><h2>Latest preliminary result</h2><dl className="project-details">
                  {[ ["Layer load", result.layer, "kN/m²"], ["Combined permanent load", result.combined, "kN/m²"], ["Total load over area", result.total, "kN"], ["Layer mass", result.mass, "kg"] ].map(([label,value,unit]) => <div key={label}><dt>{label}</dt><dd>{Number(value).toLocaleString("en-GB", {maximumFractionDigits:3})} {unit}</dd></div>)}
                </dl><p>{result.status}</p></section>;
              })()}
            </section>
          )}
          {!routes.includes(route as (typeof routes)[number]) && (
            <p>
              <a href="#dashboard">Return to dashboard</a>
            </p>
          )}
          {["survey", "materials", "estimating"].includes(visibleRoute) && (
            <Workflow
              key={pid}
              route={route}
              pid={pid}
              project={project}
              records={state.records.filter((r) => r.pid === pid)}
              user={projectUser!}
              refresh={refresh}
            />
          )}
          {["design", "construction", "quality", "handover"].includes(
            visibleRoute,
          ) && (
            <ApprovalWorkflow
              key={pid + route}
              route={route}
              pid={pid}
              project={project}
              records={state.records.filter((r) => r.pid === pid)}
              user={projectUser!}
              refresh={refresh}
            />
          )}
          {visibleRoute === "documents" && <Documents key={pid} pid={pid} />}
          {visibleRoute === "workforce" && <Workforce key={pid} pid={pid} user={user} project={project} />}
          {![
            "dashboard",
            "projects",
            "legacy",
            "structure",
            "commercial",
            "survey",
            "materials",
            "estimating",
            "design",
            "construction",
            "quality",
            "handover",
            "workforce",
            "documents",
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
