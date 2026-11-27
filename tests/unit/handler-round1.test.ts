import { describe, expect, it } from "vitest";
import { CACHE_DEGRADED, CACHE_ERR, CACHE_OK, CACHE_RATE_LIMITED, CACHE_REDIRECT } from "../../src/api/handler";
import { config } from "../../netlify/functions/teardown.mts";
import { createFixtureFetch } from "../../src/data/fixtureFetch";
import { call, failingFetch, fixtureDeps } from "../helpers";
import { handleRequest } from "../../src/api/handler";

const get = (t: string, deps = fixtureDeps()) =>
  handleRequest(new Request(`http://localhost/api/teardown?ticker=${encodeURIComponent(t)}`), deps);
const cdn = (r: Response) => r.headers.get("netlify-cdn-cache-control");

describe("round 1: rate limit config (H1)", () => {
  it("declares per-IP code-based rate limiting", () => {
    expect(config.rateLimit).toEqual({ windowLimit: 30, windowSize: 60, aggregateBy: ["ip", "domain"] });
    expect(config.rateLimit.windowSize).toBeLessThanOrEqual(180);
  });
});

describe("round 1: canonical ticker redirect (M2)", () => {
  it.each(["aapl", " AAPL ", "Aapl", "brk.b", "brk/b"])("308 for %j", async (raw) => {
    const res = await get(raw);
    expect(res.status).toBe(308);
    const norm = raw.trim().toUpperCase().replace(/[./]/g, "-");
    expect(res.headers.get("location")).toBe(`/api/teardown?ticker=${norm}`);
    expect(cdn(res)).toBe(CACHE_REDIRECT);
  });
  it("does not redirect the canonical form", async () => {
    expect((await call("AAPL")).res.status).toBe(200);
  });
  it("redirect makes no upstream calls", async () => {
    let n = 0;
    const base = createFixtureFetch();
    await get("aapl", fixtureDeps({ fetch: async (u, i) => { n++; return base(u, i); } }));
    expect(n).toBe(0);
  });
  it("invalid input still 400, duplicates 400", async () => {
    expect((await call("bad$$")).res.status).toBe(400);
    const res = await handleRequest(new Request("http://localhost/api/teardown?ticker=AAPL&ticker=MSFT"), fixtureDeps());
    expect(res.status).toBe(400);
  });
});

describe("round 1: error cache headers (M1)", () => {
  it("thrown fetch (raw TypeError) maps to 502 with short cache", async () => {
    const deps = fixtureDeps({ fetch: async () => { throw new TypeError("fetch failed"); } });
    const { res } = await call("AAPL", deps);
    expect(res.status).toBe(502);
    expect(cdn(res)).toBe(CACHE_ERR);
  });
  it("unexpected crash is 500 with short cache, not no-store", async () => {
    const deps = fixtureDeps({ fetch: async () => { throw new RangeError("boom"); } });
    const { res } = await call("AAPL", deps);
    expect(res.status).toBe(500);
    expect(cdn(res)).toBe(CACHE_ERR);
  });
  it("ConfigError stays no-store", async () => {
    const { res } = await call("AAPL", fixtureDeps({ dataMode: "live", secUserAgent: undefined }));
    expect(res.status).toBe(500);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(cdn(res)).toBeNull();
  });
});

describe("round 1: SEC 403/429 (H1)", () => {
  it.each([403, 429])("status %i -> 502, 300 s cache, distinct log, no leaks", async (status) => {
    const deps = fixtureDeps({ fetch: failingFetch(createFixtureFetch(), (u) => u.includes("companyfacts"), status), });
    const { res, text } = await call("AAPL", deps);
    expect(res.status).toBe(502);
    expect(cdn(res)).toBe(CACHE_RATE_LIMITED);
    expect(res.headers.get("retry-after")).toBe("300");
    expect(deps.logs.some((l) => l.includes("RATE_LIMITED"))).toBe(true);
    expect(text + deps.logs.join()).not.toMatch(/https?:\/\//);
    expect(text + deps.logs.join()).not.toContain("abcdef0123456789abcdef0123456789");
  });
});

describe("round 1: degraded macro TTL (L2)", () => {
  it("FRED failure -> 200 with s-maxage=300 and no SWR", async () => {
    const deps = fixtureDeps({ fetch: failingFetch(createFixtureFetch(), (u) => u.includes("stlouisfed"), 503) });
    const { res } = await call("KO", deps);
    expect(res.status).toBe(200);
    expect(cdn(res)).toBe(CACHE_DEGRADED);
    expect(cdn(res)).not.toContain("stale-while-revalidate");
  });
  it("healthy FRED keeps the long cache", async () => {
    expect(cdn((await call("KO")).res)).toBe(CACHE_OK);
  });
});
