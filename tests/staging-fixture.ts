import { generateKeyPairSync, sign } from "node:crypto";
import type { StagingConfig } from "../server/staging.ts";
export function accessFixture(origin = "https://staging.example.invalid") {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", {
      modulusLength: 2048,
    }),
    jwk = { ...publicKey.export({ format: "jwk" }), kid: "synthetic-key" };
  const config: StagingConfig = {
    origin,
    team: "https://synthetic-test.cloudflareaccess.com",
    audience: "a".repeat(64),
    accounts: {
      "owner@example.invalid": "owner-review",
      "reviewer@example.invalid": "independent-review",
    },
  };
  const token = (changes: any = {}, headerChanges: any = {}) => {
    const iat = Math.floor(Date.now() / 1000),
      header = Buffer.from(
        JSON.stringify({ alg: "RS256", kid: jwk.kid, ...headerChanges }),
      ).toString("base64url"),
      payload = Buffer.from(
        JSON.stringify({
          iss: config.team,
          aud: [config.audience],
          iat,
          exp: iat + 1800,
          type: "app",
          email: "owner@example.invalid",
          ...changes,
        }),
      ).toString("base64url"),
      content = header + "." + payload;
    return (
      content +
      "." +
      sign("RSA-SHA256", Buffer.from(content), privateKey).toString("base64url")
    );
  };
  return { config, jwk, token };
}
