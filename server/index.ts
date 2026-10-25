import { documentCommand, documentState, documentPdf } from "./documents.ts";
import { randomBytes } from "node:crypto";
import { saveCommercial } from "./commercial-control.ts";
import { workforceCommand, workforceState } from "./workforce.ts";
import { createServer } from "node:http";
import { readFileSync, existsSync, statSync } from "node:fs";
import { resolve, extname, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { Store } from "./store.ts";
import { saveGate } from "./gates.ts";
import { saveTender } from "./tender.ts";
import { renderReport } from "./report.ts";
import { positive, text, preliminaryLoad } from "../src/model.ts";
import type { User } from "../src/model.ts";
export function createApp(store: Store, root = resolve("dist")) {
  root = resolve(root);
  const workforceKey = randomBytes(32);
  const attempts = new Map<string, { n: number; until: number }>();
  return createServer(async (req, res) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "same-origin");
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
    res.setHeader(
      "Permissions-Policy",
      "camera=(), microphone=(), geolocation=(self)",
    );
    const reply = (code: number, data: unknown) => {
      res.writeHead(code, {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      });
      res.end(JSON.stringify(data));
    };
    try {
      if (
        !req.headers.host ||
        !/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(req.headers.host)
      )
        return reply(403, { error: "Only localhost access is enabled" });
      const url = new URL(req.url || "/", `http://${req.headers.host}`);
      const legacy = url.pathname.startsWith("/legacy/");
      res.setHeader(
        "Content-Security-Policy",
        legacy
          ? "default-src 'self' data: blob:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'none'; base-uri 'self'; form-action 'none'; frame-ancestors 'self'; object-src 'none'"
          : "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; frame-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'self'",
      );
      if (!url.pathname.startsWith("/api/")) {
        if (req.method !== "GET" && req.method !== "HEAD")
          return reply(405, { error: "Method not allowed" });
        let path = resolve(root, "." + decodeURIComponent(url.pathname));
        if (!path.startsWith(root + sep) && path !== root)
          return reply(403, { error: "Forbidden" });
        if (existsSync(path) && statSync(path).isDirectory())
          path = resolve(path, "index.html");
        if (!existsSync(path)) {
          if (extname(path)) return reply(404, { error: "Not found" });
          path = resolve(root, "index.html");
          if (!existsSync(path))
            return reply(503, {
              error:
                "Application build missing. Run npm run build, then retry.",
            });
        }
        const types: Record<string, string> = {
          ".html": "text/html",
          ".js": "text/javascript",
          ".css": "text/css",
          ".mp4": "video/mp4",
          ".jpg": "image/jpeg",
          ".png": "image/png",
          ".svg": "image/svg+xml",
        };
        const content = req.method === "HEAD" ? undefined : readFileSync(path);
        res.writeHead(200, {
          "Content-Type": types[extname(path)] || "application/octet-stream",
        });
        res.end(content);
        return;
      }
      if (!["GET", "HEAD"].includes(req.method || "")) {
        const origin = req.headers.origin;
        const codespace = process.env.CODESPACE_NAME;
                const forwardedOrigin = codespace && /^[a-z0-9-]+$/.test(codespace)
                  ? `https://${codespace}-${process.env.PORT || '3000'}.app.github.dev`
                  : null;
                if (!origin || (origin !== `http://${req.headers.host}` && origin !== forwardedOrigin))
          return reply(403, { error: "Same-origin request required" });
        if (!req.headers["content-type"]?.startsWith("application/json"))
          return reply(415, { error: "JSON required" });
      }
      let body: any = {};
      if (!["GET", "HEAD"].includes(req.method || "")) {
        const chunks: Buffer[] = [];
        let size = 0;
        for await (const chunk of req) {
          size += chunk.length;
          if (size > 8 * 1024 * 1024)
            return reply(413, { error: "Request too large" });
          chunks.push(chunk);
        }
        try {
          body = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
        } catch {
          return reply(400, { error: "Invalid JSON" });
        }
        if (!body || typeof body !== "object" || Array.isArray(body))
          return reply(400, { error: "JSON object required" });
      }
      if (url.pathname === "/api/login" && req.method === "POST") {
        const ip = req.socket.remoteAddress || "local",
          a = attempts.get(ip);
        if (a && a.until > Date.now() && a.n >= 10)
          return reply(429, {
            error: "Too many attempts. Try again in 15 minutes.",
          });
        const token = store.login(
          text(body.name, "Username", 100),
          text(body.password, "Password", 200),
        );
        if (!token) {
          attempts.set(ip, {
            n: a && a.until > Date.now() ? a.n + 1 : 1,
            until: Date.now() + 900000,
          });
          return reply(401, { error: "Invalid credentials" });
        }
        attempts.delete(ip);
        res.setHeader(
          "Set-Cookie",
          `jr_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800`,
        );
        return reply(200, { ok: true });
      }
      const token =
        (req.headers.cookie || "")
          .split(";")
          .map((x) => x.trim())
          .find((x) => x.startsWith("jr_session="))
          ?.slice(11) || "";
      const user = store.user(token);
      if (!user) return reply(401, { error: "Sign in required" });
      if (url.pathname === "/api/me" && req.method === "GET")
        return reply(200, user);
      if (url.pathname === "/api/logout" && req.method === "POST") {
        store.logout(token);
        res.setHeader(
          "Set-Cookie",
          "jr_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0",
        );
        return reply(200, { ok: true });
      }
      if (url.pathname.startsWith("/api/evidence/") && req.method === "GET") {
        const asset = store.db
          .prepare("SELECT * FROM evidence WHERE id=?")
          .get(url.pathname.slice("/api/evidence/".length)) as any;
        if (
          !asset ||
          !store.snapshot(user).projects.some((p) => p.id === asset.pid)
        )
          return reply(404, { error: "Evidence not found" });
        res.writeHead(200, {
          "Content-Type": asset.mime,
          "Cache-Control": "no-store",
        });
        res.end(Buffer.from(asset.bytes));
        return;
      }
      if (url.pathname.startsWith("/api/reports/") && req.method === "GET") {
        const id = url.pathname
            .slice("/api/reports/".length)
            .replace(/\.pdf$/, ""),
          state = store.snapshot(user),
          record = state.records.find(
            (r) => r.id === id && r.kind === "document",
          );
        if (!record || !state.projects.some((p) => p.id === record.pid))
          return reply(404, { error: "Report not found" });
        const approval = state.records.find(
            (r) => r.kind === "approval" && r.data.documentId === id,
          ),
          pdf = await renderReport(store, record, approval);
        res.writeHead(200, {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="jr-${record.data.type}-${record.id}.pdf"`,
          "Cache-Control": "no-store",
        });
        res.end(pdf);
        return;
      }
      if (url.pathname.startsWith("/api/dossiers/") && req.method === "GET") {
        if (user.role === "worker")
          return reply(403, {
            error: "Forbidden: project dossier access required",
          });
        const pid = url.pathname.slice("/api/dossiers/".length),
          state = store.snapshot(user),
          project = state.projects.find((p) => p.id === pid);
        if (!project) return reply(404, { error: "Project not found" });
        const records = state.records.filter((r) => r.pid === pid);
        const audit = store.db
          .prepare(
            "SELECT seq,at,actor,action,detail,previous_hash,hash FROM audit ORDER BY seq",
          )
          .all()
          .filter((r: any) => {
            if (r.action.startsWith("workforce.")) return false;
            const d = JSON.parse(r.detail);
            return (
              d.pid === pid || (r.action === "project.create" && d.id === pid)
            );
          });
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="jr-dossier-${project.id}.json"`,
        );
        return reply(200, {
          project,
          records,
          audit,
          exportedAt: new Date().toISOString(),
          notice:
            "Recorded human decisions only; not a safety certificate. Audit hashes are local tamper evidence. Gaps in project-filtered chain refer to other project events.",
        });
      }
      if (url.pathname === "/api/document-intelligence" && req.method === "GET")
        return reply(200, documentState(store,user,url.searchParams.get("pid")||""));
      if (url.pathname === "/api/document-intelligence" && req.method === "POST")
        return reply(201, documentCommand(store,user,text(body.pid,"Project",200),text(body.action,"Action",50),body.data));
      if (url.pathname === "/api/document-pdf" && req.method === "GET") {
        const pdf=await documentPdf(store,user,url.searchParams.get("pid")||"",url.searchParams.get("id")||"");
        res.writeHead(200,{"Content-Type":"application/pdf","Content-Disposition":"attachment; filename=jr-document.pdf","Cache-Control":"no-store"});res.end(pdf);return;
      }
      if (url.pathname === "/api/workforce" && req.method === "GET")
        return reply(200, workforceState(store, user, url.searchParams.get("pid") || ""));
      if (url.pathname === "/api/workforce" && req.method === "POST")
        return reply(201, workforceCommand(store, user, text(body.pid,"Project",200), text(body.action,"Action",50),body.data,workforceKey));
      if (url.pathname === "/api/commercial" && req.method === "POST")
        return reply(201,saveCommercial(store,user,text(body.pid,"Project",200),text(body.action,"Action",30),body.data));
      if (url.pathname === "/api/state" && req.method === "GET")
        return reply(200, store.snapshot(user));
      if (url.pathname === "/api/projects" && req.method === "POST")
        return reply(
          201,
          store.project(user, {
            name: text(body.name, "Project name", 200),
            client: text(body.client, "Client", 200),
            address: text(body.address, "Address", 1000),
            area: positive(body.area, "Area"),
            type: text(body.type, "Sector", 100),
            roof: text(body.roof, "Roof type", 100),
          }),
        );
      if (url.pathname === "/api/records" && req.method === "POST") {
        if (!store.snapshot(user).projects.some((p) => p.id === body.pid))
          return reply(404, { error: "Project not found" });
        return reply(
          201,
          store.transaction(() =>
            saveRecord(store, user, body.pid, body.kind, body.data),
          ),
        );
      }
      return reply(404, { error: "Endpoint not found" });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Unexpected error";
      reply(message.startsWith("Forbidden") ? 403 : 400, { error: message });
    }
  });
}
export function saveRecord(
  store: Store,
  user: User,
  pid: string,
  kind: string,
  data: any,
) {
  if (!["manager", "engineer", "supervisor"].includes(user.role))
    throw Error("Forbidden: read-only account");
  if (!data || typeof data !== "object" || Array.isArray(data))
    throw Error("Record data required");
  if (kind === "load")
    return store.append(
      user,
      pid,
      kind,
      preliminaryLoad(data.thickness, data.density, data.area, data.other),
    );
  return (
    saveGate(store, user, pid, kind, data) ||
    saveTender(store, user, pid, kind, data)
  );
}
if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1])
) {
  const port = Number(process.env.PORT || 3000),
    store = new Store(process.env.JR_DB || ".data/jr.sqlite");
  createApp(store).listen(port, "127.0.0.1", () =>
    console.log(`JR Roofing Intelligence: http://127.0.0.1:${port}`),
  );
}
