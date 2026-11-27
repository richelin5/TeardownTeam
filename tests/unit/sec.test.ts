import { describe, expect, it } from "vitest";
import { createFixtureFetch } from "../../src/data/fixtureFetch";
import { BadRequestError, NotFoundError, UpstreamError } from "../../src/data/errors";
import { TtlCache } from "../../src/data/http";
import { RESOLVER_TAGS } from "../../src/data/tagChains";
import { companyFactsUrl, createSecClient, filingUrl, normalizeTicker, padCik, type CompanyFacts } from "../../src/data/sec";

describe("normalizeTicker", () => {
  it("upper-cases, trims and maps . and / to -", () => {
    expect(normalizeTicker(" aapl ")).toBe("AAPL");
    expect(normalizeTicker("brk.b")).toBe("BRK-B");
    expect(normalizeTicker("BF/B")).toBe("BF-B");
  });
  it.each(["", "TOOLONGTICKER1", "A$PL", "../etc", "AA PL", "<script>"])("rejects %j", (t) => {
    expect(() => normalizeTicker(t)).toThrow(BadRequestError);
  });
  it("rejects non-strings", () => {
    expect(() => normalizeTicker(null)).toThrow(BadRequestError);
  });
});

describe("CIK and URLs", () => {
  it("pads CIKs to 10 digits", () => expect(padCik(320193)).toBe("0000320193"));
  it("builds primary-document and index URLs", () => {
    expect(filingUrl("0000320193", "0000320193-26-000026", "aapl-20260926.htm")).toBe(
      "https://www.sec.gov/Archives/edgar/data/320193/000032019326000026/aapl-20260926.htm",
    );
    expect(filingUrl("0000320193", "0000320193-26-000026")).toBe(
      "https://www.sec.gov/Archives/edgar/data/320193/000032019326000026/0000320193-26-000026-index.htm",
    );
    expect(filingUrl("0000320193", "0000320193-26-000026", "../evil")).toContain("-index.htm");
  });
  it.each(["", "0000320193-26-00002", "000032019326000026", "0000320193-26-000026/../../x", "../../etc", "0000320193-26-000026?x=1"])(
    "fails closed to no URL for a malformed accn %j (L3)",
    (accn) => {
      expect(filingUrl("0000320193", accn, "aapl-20260926.htm")).toBeNull();
      expect(filingUrl("0000320193", accn)).toBeNull();
    },
  );
  it("fails closed for a malformed CIK", () => {
    expect(filingUrl("320193/../x", "0000320193-26-000026")).toBeNull();
  });
});

describe("SEC client on fixtures", () => {
  it("sends the User-Agent on every request and resolves tickers from the real map", async () => {
    const seen: string[] = [];
    const base = createFixtureFetch();
    const sec = createSecClient({
      userAgent: "CompanyTeardown test@example.com",
      fetch: async (url, init) => {
        seen.push(String(new Headers(init?.headers).get("User-Agent")));
        return base(url, init);
      },
    });
    expect(await sec.lookupTicker("MSFT")).toMatchObject({ cik10: "0000789019" });
    expect(await sec.lookupTicker("KO")).toMatchObject({ cik10: "0000021344" });
    await expect(sec.lookupTicker("ZZZZZZ")).rejects.toBeInstanceOf(NotFoundError);
    expect(seen.length).toBe(1); // ticker map cached after the first call
    expect(seen.every((ua) => ua === "CompanyTeardown test@example.com")).toBe(true);
  });
  it("flags multi-class issuers", async () => {
    const sec = createSecClient({ userAgent: "x y@z", fetch: createFixtureFetch() });
    const r = await sec.lookupTicker("GOOGL");
    expect(r.otherTickers).toContain("GOOG");
  });
});

describe("SEC client failures (M1)", () => {
  it.each([
    ["network TypeError", () => new TypeError("fetch failed")],
    ["timeout", () => new DOMException("The operation was aborted due to timeout", "TimeoutError")],
    ["abort", () => new DOMException("This operation was aborted", "AbortError")],
  ])("%s becomes UpstreamError('sec', 0, 'network/timeout')", async (_n, mk) => {
    const sec = createSecClient({ userAgent: "x y@z", fetch: async () => { throw mk(); } });
    const err = await sec.lookupTicker("AAPL").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(UpstreamError);
    expect(err).toMatchObject({ service: "sec", status: 0, message: "network/timeout" });
  });
  it("a non-network error (a bug) is not disguised as upstream", async () => {
    const sec = createSecClient({ userAgent: "x y@z", fetch: async () => { throw new RangeError("boom"); } });
    await expect(sec.lookupTicker("AAPL")).rejects.toBeInstanceOf(RangeError);
  });
});

describe("companyfacts cache holds only the trimmed tags (L1)", () => {
  it("caches us-gaap RESOLVER_TAGS only, annual forms only, no dei", async () => {
    const cache = new TtlCache();
    const sec = createSecClient({ userAgent: "x y@z", fetch: createFixtureFetch(), cache });
    const cf = await sec.getCompanyFacts("0000789019");
    const cached = cache.get<CompanyFacts>(companyFactsUrl("0000789019"))!;
    expect(cached).toBe(cf);
    expect(Object.keys(cached.facts)).toEqual(["us-gaap"]);
    const tags = Object.keys(cached.facts["us-gaap"]!);
    expect(tags.length).toBeGreaterThan(5);
    expect(tags.every((t) => RESOLVER_TAGS.includes(t))).toBe(true);
    expect(tags).toContain("FinanceLeaseLiability");
    expect(tags).not.toContain("Assets");
    const forms = new Set(Object.values(cached.facts["us-gaap"]!).flatMap((c) => Object.values(c.units).flat().map((f) => f.form)));
    expect([...forms].every((f) => f === "10-K" || f === "10-K/A")).toBe(true);
    expect(JSON.stringify(cached).length).toBeLessThan(400_000);
  });
});
