import { createServer } from "vite";
import fs from "fs";
const server = await createServer({ root: process.cwd(), server: { middlewareMode: true }, appType: "custom", logLevel: "error" });
const mod = await server.ssrLoadModule("/src/api/handler.ts");
const out={};
for (const t of process.argv.slice(3)) {
  const res = await mod.handleRequest(new Request(`http://x/api/teardown?ticker=${t}`), mod.defaultDeps({ TEARDOWN_FIXTURES: "1" }));
  out[t]={status:res.status, body: await res.json(), headers:[...res.headers]};
}
fs.writeFileSync(process.argv[2], JSON.stringify(out,null,1));
await server.close();
