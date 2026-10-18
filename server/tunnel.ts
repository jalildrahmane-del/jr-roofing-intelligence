// Secret is passed only in the child environment, never argv or logs.
export function tunnelLaunch(token: string) {
  if (token.length < 50 || token.length > 8192 || /\s/.test(token))
    throw Error("A private named tunnel token is required");
  return {
    file: "/usr/local/bin/cloudflared",
    args: ["tunnel", "--no-autoupdate", "run"],
    env: { TUNNEL_TOKEN: token },
  };
}
