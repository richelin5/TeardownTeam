import { describe, expect, it } from "vitest";
import { createFixtureFetch } from "../../src/data/fixtureFetch";
import { BadRequestError, NotFoundError } from "../../src/data/errors";
import { createSecClient, filingUrl, normalizeTicker, padCik } from "../../src/data/sec";

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
