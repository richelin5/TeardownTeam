import { defineConfig, type Plugin, type ViteDevServer } from "vite";
import { resolve } from "node:path";

/**
 * Dev-only plugin: serves GET /api/teardown from src/api/handler.ts so `npm run dev`
 * (and `npm run dev:fixtures`, TEARDOWN_FIXTURES=1) works without `netlify dev`.
 * Not part of the production build; Netlify serves netlify/functions/teardown.mts.
 */
function devApi(): Plugin {
  return {
    name: "teardown-dev-api",
    configureServer(server: ViteDevServer) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url || !req.url.startsWith("/api/teardown")) return next();
        try {
          const mod = await server.ssrLoadModule("/src/api/handler.ts");
          const request = new Request(`http://localhost${req.url}`, { method: req.method ?? "GET" });
          const response: Response = await mod.handleRequest(request, mod.defaultDeps());
          res.statusCode = response.status;
          response.headers.forEach((v, k) => res.setHeader(k, v));
          res.end(await response.text());
        } catch (err) {
          console.error("[dev-api] handler failed:", err instanceof Error ? err.name : "unknown");
          res.statusCode = 500;
          res.setHeader("content-type", "application/json");
          res.end(JSON.stringify({ error: { code: "internal", message: "Internal error" } }));
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [devApi()],
  publicDir: "public",
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: false,
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, "index.html"),
        resources: resolve(import.meta.dirname, "resources.html"),
      },
    },
  },
});
