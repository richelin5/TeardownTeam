/**
 * GET /api/teardown?ticker=XXX: validation, error mapping and cache headers (netlify-deploy, secure-serverless).
 * Secrets are read only here (defaultDeps) and never echoed in bodies, headers or logs.
 */
import type { ErrorBody, ErrorCode } from "../contracts/profile";
import { BadRequestError, ConfigError, NotFoundError, TickerNotFoundError, UnsupportedFilerError, UpstreamError } from "../data/errors";
import { createFixtureFetch } from "../data/fixtureFetch";
import { TtlCache, type FetchLike } from "../data/http";
import { buildProfile } from "../data/profile";
import { createSecClient, normalizeTicker } from "../data/sec";

export type HandlerDeps = {
  fetch: FetchLike;
  secUserAgent: string | undefined;
  fredApiKey: string | undefined;
  dataMode: "live" | "fixtures";
  cache: TtlCache;
  log: (msg: string) => void;
  now?: () => Date;
};

export const CACHE_OK = "public, durable, s-maxage=3600, stale-while-revalidate=86400";
export const CACHE_ERR = "public, s-maxage=60";
/** 200 profile with a macro series missing because FRED failed: retry soon, no long stale-while-revalidate (L2). */
export const CACHE_DEGRADED = "public, durable, s-maxage=300";
/** 502 caused by an upstream 403/429 (we are being throttled): keep hammering off for 5 min at the CDN (H1). */
export const CACHE_RATE_LIMITED = "public, s-maxage=300";
/** Canonicalisation redirect (M2): the mapping input -> normalized ticker never changes, so cache it long. */
export const CACHE_REDIRECT = "public, durable, s-maxage=86400";

// Module-level cache survives across invocations on a warm instance.
const sharedCache = new TtlCache();

export function defaultDeps(env: Record<string, string | undefined> = process.env): HandlerDeps {
  const fixtures = env.TEARDOWN_FIXTURES === "1";
  return {
    fetch: fixtures ? createFixtureFetch() : (url, init) => fetch(url, init),
    secUserAgent: fixtures ? "CompanyTeardown fixture-mode" : env.SEC_USER_AGENT,
    fredApiKey: fixtures ? "fixture-mode" : env.FRED_API_KEY,
    dataMode: fixtures ? "fixtures" : "live",
    cache: sharedCache,
    log: (msg) => console.error(`[teardown] ${msg}`),
  };
}

/**
 * RESIDUAL RISK (H1), read before relying on this file for upstream protection.
 * - The per-IP rate limit in netlify/functions/teardown.mts is the only code-based limit available on
 *   non-Enterprise plans. A site-wide ("domain"-only) rule is Enterprise-only, so there is NO global cap
 *   on our outbound SEC/FRED traffic. A botnet using many IPs and many distinct valid tickers can still
 *   bypass the per-IP limit and drive cold SEC calls (SEC allows 10 req/s per client identity, ours is shared).
 * - Mitigations in place: (1) the durable CDN cache (one cold build per ticker per hour across all edges,
 *   canonical-ticker redirects so case/format variants share one cache key), (2) the per-IP limit,
 *   (3) the shared upstream limiter and <= 3 SEC calls per cold build, (4) a 5-minute CDN cache on 502s
 *   caused by SEC/FRED 403/429, so a throttled period is not retried per request.
 * - v2 plan: keep raw upstream JSON in Netlify Blobs and add a shared token bucket (also in Blobs) that all
 *   function instances consult before any SEC call, giving a true global cap independent of plan.
 */
const BASE_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "x-content-type-options": "nosniff",
  "content-security-policy": "default-src 'none'; frame-ancestors 'none'",
  "referrer-policy": "no-referrer",
};

function json(status: number, body: unknown, cdnCache: string | null, extra: Record<string, string> = {}): Response {
  const headers: Record<string, string> = { ...BASE_HEADERS, ...extra };
  if (cdnCache) {
    headers["netlify-cdn-cache-control"] = cdnCache;
    headers["cache-control"] = "public, max-age=0, must-revalidate";
    headers["netlify-vary"] = "query=ticker";
  } else {
    headers["cache-control"] = "no-store";
  }
  return new Response(JSON.stringify(body), { status, headers });
}

const err = (status: number, code: ErrorCode, message: string, cache: string | null = CACHE_ERR) =>
  json(status, { error: { code, message } } satisfies ErrorBody, cache);

export async function handleRequest(req: Request, deps: HandlerDeps): Promise<Response> {
  if (req.method !== "GET" && req.method !== "HEAD") {
    return err(405, "bad_request", "Method not allowed", null);
  }
  let ticker: string;
  try {
    const params = new URL(req.url).searchParams;
    // Duplicate ticker params would make the CDN cache key ambiguous: reject.
    if (params.getAll("ticker").length > 1) throw new BadRequestError("Duplicate ticker");
    const raw = params.get("ticker");
    ticker = normalizeTicker(raw);
    // M2: one canonical cache key per ticker. Any spelling that differs from the normalized form is redirected.
    if (raw !== ticker) {
      return new Response(null, {
        status: 308,
        headers: {
          ...BASE_HEADERS,
          location: `/api/teardown?ticker=${encodeURIComponent(ticker)}`,
          "netlify-cdn-cache-control": CACHE_REDIRECT,
          "cache-control": "public, max-age=0, must-revalidate",
          "netlify-vary": "query=ticker",
        },
      });
    }
  } catch {
    return err(400, "bad_request", "Invalid ticker. Use 1-10 letters, digits or '-'.");
  }
  try {
    if (!deps.secUserAgent || !deps.fredApiKey) throw new ConfigError("missing env");
    const sec = createSecClient({ fetch: deps.fetch, userAgent: deps.secUserAgent, cache: deps.cache });
    const profile = await buildProfile(ticker, {
      sec,
      fred: { fetch: deps.fetch, apiKey: deps.fredApiKey, cache: deps.cache },
      dataMode: deps.dataMode,
      log: deps.log,
      ...(deps.now ? { now: deps.now } : {}),
    });
    // L2: any macro series not reported (FRED failure) -> short cache so recovery is picked up quickly.
    const degraded = Object.values(profile.macro).some((m) => typeof m === "object" && m !== null && "status" in m && m.status === "not-reported");
    if (degraded) deps.log(`degraded macro for ${ticker}: short cache`);
    return json(200, profile, degraded ? CACHE_DEGRADED : CACHE_OK, { "netlify-cache-tag": `ticker-${ticker}` });
  } catch (e) {
    if (e instanceof BadRequestError) return err(400, "bad_request", "Invalid request.");
    if (e instanceof NotFoundError) {
      const msg =
        deps.dataMode === "fixtures" && !(e instanceof TickerNotFoundError)
          ? `No data for ${ticker}. Fixture mode serves only AAPL, MSFT and KO.`
          : `No SEC registrant found for ticker ${ticker}.`;
      return err(404, "not_found", msg);
    }
    if (e instanceof UnsupportedFilerError) return err(422, "unsupported_filer", "This filer is not supported in v1 (foreign/IFRS or no US GAAP data).");
    if (e instanceof UpstreamError) {
      if (e.status === 403 || e.status === 429) {
        // Rate-limit signal (SEC answers 403 for blocked UA/IP and 429 for throttling). No URLs or secrets logged.
        deps.log(`RATE_LIMITED by ${e.service} (status ${e.status}) for ${ticker}`);
        return json(502, { error: { code: "upstream_error", message: "SEC or FRED is rate limiting us. Try again in a few minutes." } } satisfies ErrorBody, CACHE_RATE_LIMITED, { "retry-after": "300" });
      }
      // status 0 = network/timeout (thrown fetch) as mapped by the data layer.
      deps.log(`upstream ${e.service} status ${e.status} for ${ticker}`);
      return err(502, "upstream_error", "SEC or FRED did not respond. Try again in a minute.");
    }
    if (e instanceof ConfigError) {
      deps.log("server misconfigured: SEC_USER_AGENT and/or FRED_API_KEY not set");
      return err(500, "internal", "Server is not configured.", null);
    }
    // Defensive: a raw fetch failure (TypeError) or abort/timeout that escaped the data layer is an upstream problem.
    if (e instanceof TypeError || (e instanceof Error && (e.name === "AbortError" || e.name === "TimeoutError"))) {
      deps.log(`upstream network failure for ${ticker}: ${e.name}`);
      return err(502, "upstream_error", "SEC or FRED did not respond. Try again in a minute.");
    }
    // Unexpected/resolver crash: short error cache (not no-store) so a crashing ticker cannot be used to hammer upstream.
    deps.log(`internal error for ${ticker}: ${e instanceof Error ? e.name : "unknown"}`);
    return err(500, "internal", "Internal error.");
  }
}
