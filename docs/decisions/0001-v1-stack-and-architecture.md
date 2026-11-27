# ADR 0001: v1 stack and architecture

Status: accepted · Date: 2026-11-27 · Author: software-architect

## Context
v1 is a read-only, unauthenticated page. One ticker produces one JSON profile built from SEC EDGAR (no CORS, requires a User-Agent) and FRED (secret key). It must deploy on Netlify with minimal moving parts, run its tests offline on real fixtures, and ship no secrets to the browser.

## Decision
| Concern | Choice | Why |
|---|---|---|
| Front end | **No framework.** Two static HTML pages (`index.html`, `resources.html`) + vanilla TypeScript modules in `src/ui/` | Small surface; easy CSP (`script-src 'self'`); nothing to learn |
| Build | **Vite** (multi-page build to `dist/`) | Bundles TS + CSS into hashed files, no inline scripts, dev server can mount the function |
| Charts | Dependency-free **inline SVG** built with `createElementNS` | No chart library, CSP-safe, prints crisply |
| API | One **Netlify Function** `netlify/functions/teardown.mts`, `config.path = "/api/teardown"`, thin wrapper over `src/api/handler.ts` | All upstream calls stay server-side, where the secrets live |
| Data layer | `src/data/`: SEC + FRED clients taking an **injectable `fetch`**, a pure resolver `(companyfacts, submissions) → table`, tag chains, period logic | Deterministic tests on fixtures |
| Contract | `src/contracts/profile.ts`: shared types used by the function and the UI | One source of truth |
| Tests | **Vitest** (unit, function, golden tie-out tests) | Fast, TS-native |
| Caching | CDN: `Netlify-CDN-Cache-Control: public, durable, s-maxage=3600, stale-while-revalidate=86400`, `Netlify-Vary: query=ticker`, `Netlify-Cache-Tag: ticker-<T>`. Errors: `s-maxage=60`. In-memory (warm instance) cache: ticker map 24 h, submissions 1 h, companyfacts 6 h, FRED 1 h. **No Blobs in v1** (optional, backlog) | CDN durable cache is the main rate-limit shield. Blobs add a dependency for little v1 gain |
| Secrets | `process.env.SEC_USER_AGENT`, `process.env.FRED_API_KEY`, read only in the function | Never bundled |
| Fixture mode | `TEARDOWN_FIXTURES=1` swaps the injected fetch for `fixtureFetch`, which maps SEC/FRED URLs to files in `fixtures/` (AAPL, MSFT, KO). The same parsing and resolver code path runs. No keys or network needed | Lets this container (no SEC/FRED egress) preview and screenshot the real app |
| Local dev | `npm run dev`: Vite dev server plus a small middleware plugin (`vite.config.ts`) that serves `/api/teardown` from `src/api/handler.ts` through `ssrLoadModule` | `netlify dev` is optional and needs network |
| Runtime deps | **Zero.** Dev deps: typescript, vite, vitest, @types/node | Minimal supply-chain surface |

## Request flow
`GET /api/teardown?ticker=AAPL` → validate (400) → ticker map → CIK (404) → submissions + companyfacts (in parallel, ≤ 5 concurrent, retry 429/503 ×3) + FRED DGS10/FEDFUNDS (parallel; failure degrades only that series) → resolver → `Profile` JSON + cache headers.

## Error mapping
`BadRequestError` 400 · `NotFoundError` 404 · `UnsupportedFilerError` 422 · `UpstreamError` 502 · `ConfigError`/other 500. Bodies: `{ "error": { "code", "message" } }`, generic messages, no stack traces, no upstream URLs.

## Consequences
- The UI never computes metrics. Growth and margins arrive precomputed with sources.
- The fixture files are not bundled for production. Fixture mode reads them from `process.cwd()/fixtures` and is for local use only. Never set `TEARDOWN_FIXTURES` on Netlify.
- Adding a framework, Blobs or another data source needs a new ADR.
