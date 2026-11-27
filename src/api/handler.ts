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
    ticker = normalizeTicker(new URL(req.url).searchParams.get("ticker"));
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
    return json(200, profile, CACHE_OK, { "netlify-cache-tag": `ticker-${ticker}` });
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
      deps.log(`upstream ${e.service} status ${e.status} for ${ticker}`);
      return err(502, "upstream_error", "SEC or FRED did not respond. Try again in a minute.");
    }
    if (e instanceof ConfigError) {
      deps.log("server misconfigured: SEC_USER_AGENT and/or FRED_API_KEY not set");
      return err(500, "internal", "Server is not configured.", null);
    }
    deps.log(`internal error for ${ticker}: ${e instanceof Error ? e.name : "unknown"}`);
    return err(500, "internal", "Internal error.", null);
  }
}
