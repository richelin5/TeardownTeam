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

/**
 * Build-time site URL for Open Graph/Twitter tags (crawlers need absolute URLs).
 * Netlify sets URL (the site's main address) during builds; SITE_URL overrides it.
 * Only a plain https origin is accepted; anything else falls back to "" (relative URLs).
 */
function siteUrl(): Plugin {
  const raw = (process.env.SITE_URL ?? process.env.URL ?? "").trim().replace(/\/+$/, "");
  const url = /^https:\/\/[a-z0-9.-]+(:\d+)?$/i.test(raw) ? raw : "";
  return {
    name: "teardown-site-url",
    transformIndexHtml: (html: string) => html.replaceAll("%SITE_URL%", url),
  };
}

export default defineConfig({
  plugins: [devApi(), siteUrl()],
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
