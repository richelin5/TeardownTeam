import { describe, expect, it } from "vitest";
import { CACHE_ERR, CACHE_OK, defaultDeps } from "../../src/api/handler";
import type { ErrorBody, Profile } from "../../src/contracts/profile";
import { createFixtureFetch } from "../../src/data/fixtureFetch";
import { call, failingFetch, fixtureDeps } from "../helpers";

const SECRET_KEY = "abcdef0123456789abcdef0123456789";
const SECRET_UA = "CompanyTeardown test@example.com";

describe("GET /api/teardown", () => {
  it.each([
    ["AAPL", "0000320193", "0925", "3571"],
    ["MSFT", "0000789019", "0630", "7372"],
    ["KO", "0000021344", "1231", "2080"],
  ])("%s returns contract JSON with CDN cache headers", async (t, cik, fye, sic) => {
    // Canonical (upper-case) ticker: lower-case input now 308-redirects (handler-round1.test.ts covers that).
    const { res, body, text } = await call(t);
    expect(res.status).toBe(200);
    const p = body as Profile;
    expect(p.company).toMatchObject({ ticker: t, cik, fiscalYearEnd: fye, sic });
    expect(p.table.years).toHaveLength(5);
    expect(res.headers.get("netlify-cdn-cache-control")).toBe(CACHE_OK);
    expect(res.headers.get("netlify-vary")).toBe("query=ticker");
    expect(res.headers.get("netlify-cache-tag")).toBe(`ticker-${t}`);
    expect(res.headers.get("cache-control")).toBe("public, max-age=0, must-revalidate");
    expect(text).not.toContain(SECRET_KEY);
    expect(text).not.toContain(SECRET_UA);
  });

  it.each(["bad$$", "", "TOOLONGTICKER1", "a b"])("returns 400 for %j before any upstream call", async (t) => {
    let calls = 0;
    const base = createFixtureFetch();
    const { res, body } = await call(t, fixtureDeps({ fetch: async (u, i) => { calls++; return base(u, i); } }));
    expect(res.status).toBe(400);
    expect((body as ErrorBody).error.code).toBe("bad_request");
    expect(calls).toBe(0);
    expect(res.headers.get("netlify-cdn-cache-control")).toBe(CACHE_ERR);
  });

  it("returns 400 when ticker is missing", async () => {
    expect((await call(null)).res.status).toBe(400);
  });

  it("returns 404 for an unknown ticker, with short error caching and no stack", async () => {
    const { res, body, text } = await call("ZZZZZZ");
    expect(res.status).toBe(404);
    expect((body as ErrorBody).error).toEqual({ code: "not_found", message: "No SEC registrant found for ticker ZZZZZZ." });
    expect(res.headers.get("netlify-cdn-cache-control")).toBe(CACHE_ERR);
    expect(text).not.toMatch(/at \w+ \(|\.ts:/);
  });

  it("returns 404 in fixture mode for a real ticker without fixtures", async () => {
    const { res, body } = await call("GOOGL");
    expect(res.status).toBe(404);
    expect((body as ErrorBody).error.message).toContain("Fixture mode serves only AAPL, MSFT and KO");
  });

  it("returns 405 for non-GET", async () => {
    expect((await call("AAPL", fixtureDeps(), "POST")).res.status).toBe(405);
  });

  it("returns 502 when SEC fails, without leaking URLs or keys", async () => {
    const deps = fixtureDeps({ fetch: failingFetch(createFixtureFetch(), (u) => u.includes("companyfacts"), 500) });
    const { res, text } = await call("AAPL", deps);
    expect(res.status).toBe(502);
    expect(text).not.toContain("data.sec.gov");
    expect(deps.logs.join()).not.toContain(SECRET_KEY);
  });

  it("still returns 200 when FRED fails (that series is not reported)", async () => {
    const deps = fixtureDeps({ fetch: failingFetch(createFixtureFetch(), (u) => u.includes("stlouisfed"), 503) });
    const { res, body, text } = await call("KO", deps);
    expect(res.status).toBe(200);
    expect((body as Profile).macro.dgs10.status).toBe("not-reported");
    expect(text + deps.logs.join()).not.toContain(SECRET_KEY);
  });

  it("returns 500 with no-store when env is missing in live mode, naming no secret", async () => {
    const deps = fixtureDeps({ dataMode: "live", secUserAgent: undefined, fredApiKey: undefined });
    const { res, body } = await call("AAPL", deps);
    expect(res.status).toBe(500);
    expect((body as ErrorBody).error.message).toBe("Server is not configured.");
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("returns 422 for a filer without us-gaap facts", async () => {
    const base = createFixtureFetch();
    const deps = fixtureDeps({
      fetch: async (u, i) => (u.includes("companyfacts") ? new Response(JSON.stringify({ cik: 1, entityName: "X", facts: { "ifrs-full": {} } }), { status: 200 }) : base(u, i)),
    });
    expect((await call("AAPL", deps)).res.status).toBe(422);
  });
});

describe("defaultDeps", () => {
  it("fixture mode needs no keys and reports dataMode", () => {
    const d = defaultDeps({ TEARDOWN_FIXTURES: "1" });
    expect(d.dataMode).toBe("fixtures");
  });
  it("live mode reads env only", () => {
    const d = defaultDeps({ SEC_USER_AGENT: "A b@c", FRED_API_KEY: "k" });
    expect(d).toMatchObject({ dataMode: "live", secUserAgent: "A b@c", fredApiKey: "k" });
  });
});
