import { createPublicKey, verify } from "node:crypto";
export type StagingConfig = {
  origin: string;
  team: string;
  audience: string;
  accounts: Record<string, string>;
};
export function stagingConfig(
  env: NodeJS.ProcessEnv = process.env,
): StagingConfig | undefined {
  if (!env.JR_MODE || env.JR_MODE === "local") return;
  if (env.JR_MODE !== "owner-staging") throw Error("Unknown JR_MODE");
  let origin: URL;
  try {
    origin = new URL(env.JR_PUBLIC_ORIGIN || "invalid");
  } catch {
    throw Error("A single HTTPS public hostname is required");
  }
  if (
    origin.protocol !== "https:" ||
    origin.username ||
    origin.password ||
    origin.pathname !== "/" ||
    origin.search ||
    origin.hash ||
    origin.port ||
    !origin.hostname.includes(".") ||
    /^(localhost|127\.|\[)/.test(origin.hostname)
  )
    throw Error("A single HTTPS public hostname is required");
  const team = env.JR_ACCESS_TEAM || "";
  if (!/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/.test(team))
    throw Error("Cloudflare Access team URL required");
  const audience = env.JR_ACCESS_AUD || "";
  if (!/^[a-f0-9]{64}$/.test(audience))
    throw Error("Cloudflare Access application audience required");
  let accounts: any;
  try {
    accounts = JSON.parse(env.JR_ACCESS_ACCOUNTS || "");
  } catch {
    throw Error("Explicit email-to-local-account mapping required");
  }
  if (
    !accounts ||
    Array.isArray(accounts) ||
    typeof accounts !== "object" ||
    !Object.keys(accounts).length ||
    Object.keys(accounts).length > 10
  )
    throw Error("One to ten named owner reviewers required");
  for (const [email, name] of Object.entries(accounts))
    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      email !== email.toLowerCase() ||
      typeof name !== "string" ||
      !name.trim() ||
      name.length > 100
    )
      throw Error("Invalid owner access mapping");
  if (
    env.JR_STAGING_DATA !== "synthetic-only" ||
    env.JR_DB !== "/data/jr-staging.sqlite" ||
    env.RAILWAY_VOLUME_MOUNT_PATH !== "/data"
  )
    throw Error("Synthetic-only staging and persistent /data volume required");
  if (
    ["OPENAI_API_KEY", "RESEND_API_KEY", "RAILWAY_API_TOKEN"].some(
      (k) => !!env[k],
    )
  )
    throw Error(
      "Unnecessary integration credentials must not be installed in staging",
    );
  return { origin: origin.origin, team, audience, accounts };
}
function decode(s: string) {
  if (!/^[A-Za-z0-9_-]+$/.test(s)) throw Error("Invalid token");
  const bytes = Buffer.from(s, "base64url");
  if (bytes.toString("base64url") !== s) throw Error("Invalid token");
  return JSON.parse(bytes.toString("utf8"));
}
export function stagingVerifier(
  config: StagingConfig,
  fetchKeys: () => Promise<any> = async () => {
    const response = await fetch(config.team + "/cdn-cgi/access/certs", {
      redirect: "error",
      signal: AbortSignal.timeout(3000),
    });
    if (!response.ok) throw Error("Access verification unavailable");
    const chunks: Uint8Array[] = [];
    let size = 0;
    for await (const chunk of response.body!) {
      size += chunk.length;
      if (size > 65536) throw Error("Invalid Access key response");
      chunks.push(chunk);
    }
    return JSON.parse(Buffer.concat(chunks).toString());
  },
) {
  let keys: any[] = [],
    expires = 0,
    lastRefresh = -Infinity,
    pending: Promise<void> | undefined;
  const refresh = async () => {
    if (pending) return pending;
    if (Date.now() - lastRefresh < 1000)
      throw Error("Access verification unavailable");
    lastRefresh = Date.now();
    pending = (async () => {
      const data = await fetchKeys();
      if (
        !Array.isArray(data.keys) ||
        !data.keys.length ||
        data.keys.length > 20
      )
        throw Error("Invalid Access keys");
      keys = data.keys.filter(
        (k: any) =>
          k.kty === "RSA" &&
          typeof k.kid === "string" &&
          typeof k.n === "string" &&
          Buffer.from(k.n, "base64url").length >= 256 &&
          k.e === "AQAB",
      );
      expires = Date.now() + 300000;
    })();
    try {
      await pending;
    } finally {
      pending = undefined;
    }
  };
  return async (token: unknown) => {
    if (typeof token !== "string" || token.length > 16384)
      throw Error("Access sign-in required");
    const parts = token.split(".");
    if (parts.length !== 3) throw Error("Invalid Access token");
    const [header, payload] = [decode(parts[0]), decode(parts[1])];
    if (
      header.alg !== "RS256" ||
      typeof header.kid !== "string" ||
      header.kid.length > 200 ||
      header.crit
    )
      throw Error("Invalid Access signature algorithm");
    if (Date.now() >= expires) await refresh();
    let key = keys.find((k) => k.kid === header.kid);
    if (!key) {
      await refresh();
      key = keys.find((k) => k.kid === header.kid);
    }
    if (!key) throw Error("Unknown Access signing key");
    const signature = Buffer.from(parts[2], "base64url");
    if (
      signature.toString("base64url") !== parts[2] ||
      !verify(
        "RSA-SHA256",
        Buffer.from(parts[0] + "." + parts[1]),
        createPublicKey({ key, format: "jwk" }),
        signature,
      )
    )
      throw Error("Invalid Access signature");
    const now = Math.floor(Date.now() / 1000),
      aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
    if (
      payload.iss !== config.team ||
      !aud.includes(config.audience) ||
      payload.type !== "app" ||
      !Number.isSafeInteger(payload.exp) ||
      payload.exp <= now ||
      !Number.isSafeInteger(payload.iat) ||
      payload.iat > now + 30 ||
      payload.exp - payload.iat > 3600 ||
      (payload.nbf !== undefined &&
        (!Number.isSafeInteger(payload.nbf) || payload.nbf > now)) ||
      typeof payload.email !== "string" ||
      !Object.hasOwn(config.accounts, payload.email.toLowerCase())
    )
      throw Error("Access identity not authorised");
    return {
      email: payload.email.toLowerCase(),
      account: config.accounts[payload.email.toLowerCase()],
    };
  };
}
