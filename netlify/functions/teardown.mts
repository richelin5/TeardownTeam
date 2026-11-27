// Netlify Function: GET /api/teardown?ticker=XXX (ADR 0001). Thin wrapper over src/api/handler.ts.
import { defaultDeps, handleRequest } from "../../src/api/handler";

export default async (req: Request): Promise<Response> => handleRequest(req, defaultDeps());

/**
 * Netlify code-based rate limiting (docs.netlify.com/manage/security/secure-access-to-sites/rate-limiting/):
 * available on all plans, must live in the function config (not netlify.toml), windowSize max 180 s.
 * aggregateBy ["ip","domain"] counts per client IP. (A domain-only site-wide rule is Enterprise-only.)
 * Sizing: a cold request costs <= 3 SEC calls; SEC allows 10 req/s. 30 req/min/IP means one IP can trigger at
 * most 30 * 3 = 90 SEC calls/min (1.5/s, 15% of the SEC budget), and only if every request is a distinct cold
 * ticker; warm CDN hits cost 0. Real users look up a handful of tickers per minute. Residual risk (no global
 * cap on non-Enterprise plans) is documented in src/api/handler.ts.
 */
export const config = {
  path: "/api/teardown",
  rateLimit: { windowLimit: 30, windowSize: 60, aggregateBy: ["ip", "domain"] },
};
