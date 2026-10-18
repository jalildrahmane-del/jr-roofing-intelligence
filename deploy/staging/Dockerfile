FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json vite.config.ts index.html ./
COPY src ./src
COPY server ./server
COPY scripts ./scripts
COPY tests ./tests
COPY public ./public
RUN npm run build && npm prune --omit=dev
# Official cloudflared 2026.10.1, checksum-pinned for each supported architecture.
RUN node --input-type=module -e 'import {writeFileSync} from "node:fs"; import {createHash} from "node:crypto"; const arch=process.arch==="x64"?"amd64":process.arch==="arm64"?"arm64":null; const hashes={amd64:"3bfc539f45d2620c71debb7a86be0efa737ed5ccbad9eb85c787116900e5c586",arm64:"2c65dfabf616c40efc7545d107d7a57ad5e21377e2964b7e88af19a238074a46"}; if(!arch)throw Error("Unsupported architecture"); const r=await fetch("https://github.com/cloudflare/cloudflared/releases/download/2026.10.1/cloudflared-linux-"+arch); if(!r.ok)throw Error("Tunnel binary download failed"); const b=Buffer.from(await r.arrayBuffer()); if(createHash("sha256").update(b).digest("hex")!==hashes[arch])throw Error("Tunnel binary checksum failed"); writeFileSync("/cloudflared",b,{mode:0o755});'


FROM node:24-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && rm -rf /var/lib/apt/lists/*
COPY --from=build /cloudflared /usr/local/bin/cloudflared
COPY --from=build /app/node_modules ./node_modules
COPY package.json ./
COPY --from=build /app/dist ./dist
COPY server ./server
COPY src ./src
COPY scripts ./scripts
# No keys, test passwords, database, backup or .env files are copied.
# Entry point drops privileges after assigning the root-owned /data mount.
CMD ["node", "scripts/staging-start.ts"]
