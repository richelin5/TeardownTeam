# Deploying on Netlify (Functions + Caching)

Goal: a static front end plus a single serverless function, `/api/teardown?ticker=AAPL`, that calls SEC and FRED on the server, normalizes the data, and is cached so we stay well within SEC's 10 req/s and FRED's 120 req/min limits.

Verified against Netlify docs on 2026-11-27.

## Why a function at all
- `data.sec.gov` has **no CORS**, and SEC requires a declared `User-Agent`, which browsers won't let page JavaScript set.
- The FRED API key must stay secret.
- So the browser only ever talks to our own origin.

## Project layout

```
/
├── netlify.toml
├── package.json
├── public/                 # static front end (index.html, app.js, styles.css)
└── netlify/
    └── functions/
        └── teardown.mts    # GET /api/teardown?ticker=XXX
```

`netlify.toml`:
```toml
[build]
  publish = "public"
  # command = "npm run build"   # if using a framework/bundler

[functions]
  directory = "netlify/functions"
  node_bundler = "esbuild"
```

## Function skeleton (modern Netlify Functions API)

Netlify functions default-export a handler that takes a web `Request` and returns a web `Response`. Routing is set with `config.path`.

```ts
// netlify/functions/teardown.mts
import type { Config, Context } from "@netlify/functions";

const UA = process.env.SEC_USER_AGENT!;      // e.g. "CompanyTeardown contact@yourdomain.com"
const FRED_KEY = process.env.FRED_API_KEY!;

async function sec(url: string) {
  const r = await fetch(url, { headers: { "User-Agent": UA, "Accept-Encoding": "gzip, deflate" } });
  if (!r.ok) throw new Error(`SEC ${r.status} ${url}`);
  return r.json();
}

export default async (req: Request, _ctx: Context) => {
  const ticker = new URL(req.url).searchParams.get("ticker")?.toUpperCase().replace(/[./]/g, "-");
  if (!ticker || !/^[A-Z0-9-]{1,10}$/.test(ticker)) {
    return Response.json({ error: "bad ticker" }, { status: 400 });
  }

  // 1) ticker → CIK (cache this map; see Blobs below)
  // 2) submissions + companyfacts in parallel
  // 3) FRED series in parallel
  // 4) resolve → { metrics: [{ value, tag, accn, form, filed, start, end, url }], ... }

  const body = { ticker /* ...normalized profile... */ };

  return Response.json(body, {
    headers: {
      // Netlify-only CDN caching; the browser always revalidates
      "Netlify-CDN-Cache-Control": "public, durable, s-maxage=3600, stale-while-revalidate=86400",
      "Cache-Control": "public, max-age=0, must-revalidate",
      "Netlify-Vary": "query=ticker",
      "Netlify-Cache-Tag": `ticker-${ticker}`,
    },
  });
};

export const config: Config = { path: "/api/teardown" };
```

Install dependencies with `npm install @netlify/functions @netlify/blobs`.

## Caching strategy (three layers)

### Layer 1: Netlify CDN cache on the function response (the biggest win)
- Function responses are **not cached by default**. Netlify's default for dynamic responses is `Cache-Control: public, max-age=0, must-revalidate`. We opt in with headers.
- `Netlify-CDN-Cache-Control` applies only to Netlify's CDN, so browser caching can be controlled separately with `Cache-Control`.
- `s-maxage=3600`: serve from the edge for 1 hour.
- `stale-while-revalidate=86400`: after that, keep serving stale content instantly while it refreshes in the background, for up to 1 day.
- **`durable`**: stores the response in Netlify's shared durable cache, so *other* edge nodes reuse it instead of invoking the function again. Netlify specifically notes this helps with third-party rate limits. It works for Functions only, not Edge Functions.
- **Cache key:** query parameters are part of the function cache key by default. `Netlify-Vary: query=ticker` makes **only** `ticker` count, so `?ticker=AAPL&utm=x` hits the same entry.
- **Normalize the ticker before it reaches the URL.** The query-parameter match is case-sensitive, so `aapl` and `AAPL` are different keys. Have the front end upper-case it, or redirect.
- **Invalidation:** every deploy purges the cache automatically. For on-demand purges, tag responses (`Netlify-Cache-Tag: ticker-AAPL`) and call `purgeCache({ tags: ["ticker-AAPL"] })` from `@netlify/cache`, which can purge each tag at most twice per 5 seconds.
- Debug with the `Cache-Status` response header (`"Netlify Edge"; hit`, `"Netlify Durable"; hit`, `fwd=miss`, …).

### Layer 2: Netlify Blobs for upstream raw data
Use this for things that are expensive to fetch and shared across tickers, or that should survive deploys:

```ts
import { getStore } from "@netlify/blobs";

const store = getStore("sec-cache");

async function cached<T>(key: string, ttlSec: number, fetcher: () => Promise<T>): Promise<T> {
  const hit = await store.getWithMetadata(key, { type: "json" });
  if (hit && Date.now() - (hit.metadata.ts as number) < ttlSec * 1000) return hit.data as T;
  const fresh = await fetcher();
  await store.setJSON(key, fresh, { metadata: { ts: Date.now() } });
  return fresh;
}

const tickers = await cached("company_tickers", 86400,
  () => sec("https://www.sec.gov/files/company_tickers.json"));
```

- Blobs is a key-value store available inside functions with zero configuration. The default is **eventual consistency**: new keys show up immediately, and updates propagate within about 60 seconds. You can opt into `consistency: "strong"` when needed.
- Limits: store names up to 64 bytes, keys up to 600 bytes, metadata up to 2 KB, objects up to 5 GB.
- Suggested TTLs:

| Data | TTL |
|---|---|
| ticker map | 24 h |
| submissions | 1 h |
| companyfacts | 6–24 h (bust when the newest `accessionNumber` in submissions changes) |
| FRED | 1–6 h |

- Store a **trimmed** companyfacts (only the tags we use) to keep reads fast.

### Layer 3: in-memory (warm container)
A module-level `Map` survives between invocations on a warm instance. It's free and good enough for the ticker map, but never rely on it.

## Environment variables
Set these in Netlify UI → Project configuration → Environment variables, or with the CLI:

```bash
netlify env:set SEC_USER_AGENT "CompanyTeardown contact@yourdomain.com"
```

```bash
netlify env:set FRED_API_KEY "<32-char key>"
```

Read them with `process.env.X` (or `Netlify.env.get("X")`). Never commit them. Add `.env` to `.gitignore` for local use.

## Local development and deploys

Run locally with the CLI, which emulates functions, Blobs and env vars:

```bash
npm install -g netlify-cli
```

```bash
netlify dev
```

Vite-based frameworks can use `@netlify/vite-plugin` instead. Then:
- **Continuous deployment:** connect the GitHub repo in Netlify. Pushes to `main` deploy to production, and PRs get Deploy Previews.
- Manual deploys: `netlify deploy` (draft) and `netlify deploy --prod`.
- Logs: Netlify UI → Functions → teardown, or `netlify logs:function teardown`.

## Operational guardrails
- **Timeouts:** Netlify's configuration docs list the synchronous execution limit as **60 seconds, not configurable** (older docs and plans said 10–26 s, so check your plan). companyfacts for mega-caps can be several MB, so keep work parallel and lean, and lean on the caches. Memory can be raised with `config.memory` on supported plans.
- **Upstream limiter:** cap concurrent SEC fetches (e.g. 5), and retry 429/503 with exponential backoff and jitter. Return a clear error to the UI ("SEC is rate-limiting; try again in a minute") instead of a blank page.
- **Validate input** (ticker regex) before doing any upstream calls, so the cache can't be flooded with junk keys.
- **Optional warm-up:** a Netlify Scheduled Function (`config.schedule = "@hourly"`) can pre-fetch FRED, and optionally the top-N tickers, into Blobs.
- **Free-tier fit:** with CDN + durable caching, repeat views of popular tickers cost zero function invocations.

## Sources
- Get started with functions: https://docs.netlify.com/build/functions/get-started/
- Caching overview (headers, durable, SWR, Netlify-Vary, purge, Cache-Status): https://docs.netlify.com/build/caching/caching-overview/
- Netlify Blobs: https://docs.netlify.com/build/data-and-storage/netlify-blobs/
- Functions configuration (paths, schedule, limits): https://docs.netlify.com/build/functions/configuration/
