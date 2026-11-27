// Local production-like preview, no network or keys: serves the built dist/ with the security headers from
// netlify.toml and mounts /api/teardown from src/api/handler.ts in fixture mode (TEARDOWN_FIXTURES=1).
// Usage: npm run build && node scripts/preview-fixtures.mjs [port]
import http from "node:http";
import { readFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { createServer as createVite } from "vite";

const port = Number(process.argv[2] ?? 4173);
const root = join(process.cwd(), "dist");
const toml = readFileSync("netlify.toml", "utf8");
const globalBlock = toml.split('for = "/*"')[1]?.split("[[headers]]")[0] ?? "";
const headers = Object.fromEntries([...globalBlock.matchAll(/^\s*([A-Za-z-]+)\s*=\s*"(.*)"\s*$/gm)].map((m) => [m[1], m[2]]));
delete headers["Strict-Transport-Security"]; // http://localhost
headers["Content-Security-Policy"] = (headers["Content-Security-Policy"] ?? "").replace("; upgrade-insecure-requests", "");
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".json": "application/json" };

const vite = await createVite({ root: process.cwd(), server: { middlewareMode: true }, appType: "custom", logLevel: "error", optimizeDeps: { noDiscovery: true, include: [] } });
const { handleRequest, defaultDeps } = await vite.ssrLoadModule("/src/api/handler.ts");
const deps = defaultDeps({ TEARDOWN_FIXTURES: "1" });

http
  .createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", `http://localhost:${port}`);
    if (url.pathname === "/api/teardown") {
      const r = await handleRequest(new Request(url, { method: req.method }), deps);
      res.writeHead(r.status, Object.fromEntries(r.headers));
      res.end(await r.text());
      return;
    }
    let decoded;
    try {
      decoded = decodeURIComponent(url.pathname);
    } catch {
      res.writeHead(400, { ...headers, "content-type": "text/plain" });
      res.end("Bad request");
      return;
    }
    let path = normalize(decoded).replace(/^(\.\.[/\\])+/, "");
    if (path.endsWith("/")) path += "index.html";
    try {
      const body = await readFile(join(root, path));
      res.writeHead(200, { ...headers, "content-type": types[extname(path)] ?? "application/octet-stream" });
      res.end(body);
    } catch {
      res.writeHead(404, { ...headers, "content-type": "text/plain" });
      res.end("Not found");
    }
  })
  .listen(port, "127.0.0.1", () => console.log(`preview (fixture mode) on http://127.0.0.1:${port}`));
