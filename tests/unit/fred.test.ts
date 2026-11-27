import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createFixtureFetch } from "../../src/data/fixtureFetch";
import { fetchMacro, fetchRate, latestObservation } from "../../src/data/fred";
import { UpstreamError } from "../../src/data/errors";

const KEY = "abcdef0123456789abcdef0123456789";

describe("FRED", () => {
  it("skips '.' missing observations", () => {
    expect(latestObservation({ observations: [{ date: "2026-11-11", value: "." }, { date: "2026-11-10", value: "4.95" }] })).toEqual({ date: "2026-11-10", value: 4.95 });
    expect(latestObservation({ observations: [{ date: "2026-11-11", value: "." }] })).toBeNull();
  });
  it("reads the real fixtures: DGS10 and FEDFUNDS with observation dates", async () => {
    const f = createFixtureFetch();
    const d = await fetchRate("DGS10", { fetch: f, apiKey: KEY });
    const raw = JSON.parse(readFileSync("fixtures/fred/DGS10-observations.json", "utf8"));
    const first = raw.observations.find((o: { value: string }) => o.value !== ".");
    expect(d.value).toBe(Number(first.value));
    expect(d.sources[0]).toEqual({ kind: "fred", seriesId: "DGS10", observationDate: first.date, url: "https://fred.stlouisfed.org/series/DGS10" });
    const ff = await fetchRate("FEDFUNDS", { fetch: f, apiKey: KEY });
    expect(ff).toMatchObject({ value: 3.88, status: "reported" });
    expect(ff.sources[0]).toMatchObject({ observationDate: "2026-10-01" });
  });
  it("sends the key only to api.stlouisfed.org with file_type=json", async () => {
    const urls: string[] = [];
    const base = createFixtureFetch();
    await fetchRate("DGS10", { fetch: async (u, i) => { urls.push(u); return base(u, i); }, apiKey: KEY });
    expect(urls[0]).toMatch(/^https:\/\/api\.stlouisfed\.org\/fred\/series\/observations\?series_id=DGS10&api_key=.+&file_type=json&sort_order=desc&limit=10$/);
  });
  it("degrades one failing series to not-reported without leaking the key", async () => {
    const logs: string[] = [];
    const base = createFixtureFetch();
    const macro = await fetchMacro(
      { fetch: async (u, i) => (u.includes("FEDFUNDS") ? new Response("nope", { status: 500 }) : base(u, i)), apiKey: KEY },
      (m) => logs.push(m),
    );
    expect(macro.dgs10.status).toBe("reported");
    expect(macro.fedfunds).toMatchObject({ status: "not-reported", value: null });
    expect(JSON.stringify(macro) + logs.join()).not.toContain(KEY);
  });
  it("a thrown fetch or timeout becomes UpstreamError('fred', 0) without the key, and degrades only that series (M1)", async () => {
    const err = await fetchRate("DGS10", { fetch: async () => { throw new TypeError(`fetch failed for ...api_key=${KEY}`); }, apiKey: KEY }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(UpstreamError);
    expect(err).toMatchObject({ service: "fred", status: 0, message: "network/timeout" });
    expect(String((err as Error).message)).not.toContain(KEY);
    const logs: string[] = [];
    const base = createFixtureFetch();
    const macro = await fetchMacro(
      { fetch: async (u, i) => { if (u.includes("FEDFUNDS")) throw new DOMException("timeout", "TimeoutError"); return base(u, i); }, apiKey: KEY },
      (m) => logs.push(m),
    );
    expect(macro.dgs10.status).toBe("reported");
    expect(macro.fedfunds.status).toBe("not-reported");
    expect(logs.join()).toContain("status 0");
    expect(logs.join()).not.toContain(KEY);
  });
});
