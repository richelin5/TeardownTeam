import { describe, expect, it } from "vitest";
import type { Metric } from "../../src/contracts/profile";
import { normalizeTicker } from "../../src/data/sec";
import { describeSource, fiscalYearEndText, macroDateText, monthYear, statusText } from "../../src/ui/format";
import { normalizeTickerUi } from "../../src/ui/ticker";

const fred = (seriesId: "DGS10" | "FEDFUNDS", observationDate: string) => ({ kind: "fred" as const, seriesId, observationDate, url: `https://fred.stlouisfed.org/series/${seriesId}` });
const metric = (over: Partial<Metric>): Metric => ({ id: "x", label: "x", value: 1, unit: "percent", status: "reported", sources: [], ...over });

describe("fiscal year end wording", () => {
  it("fixed Dec 31 vs floating year ends", () => {
    expect(fiscalYearEndText("1231", "2025-12-31")).toBe("Dec 31");
    expect(fiscalYearEndText("0925", "2026-09-26")).toBe("Sep (latest FY ended 2026-09-26)");
    expect(fiscalYearEndText("0630")).toBe("Jun");
  });
});

describe("macro wording", () => {
  it("monthly Fed funds shows the month; DGS10 keeps its date", () => {
    expect(macroDateText(fred("FEDFUNDS", "2026-10-01"))).toBe("Oct-2026 average");
    expect(macroDateText(fred("DGS10", "2026-11-25"))).toBe("as of 2026-11-25");
    expect(monthYear("2026-01-01")).toBe("Jan-2026");
    expect(describeSource(fred("FEDFUNDS", "2026-10-01"), "USD")).toContain("Oct-2026 monthly average");
  });
  it("FRED sources say 'FRED observation', not the XBRL status", () => {
    expect(statusText(metric({ sources: [fred("DGS10", "2026-11-25")] }))).toBe("FRED observation");
  });
});

describe("status wording", () => {
  it("uses lowercase 'not reported'", () => {
    expect(statusText(metric({ status: "not-reported", value: null }))).toBe("not reported");
  });
});

describe("ticker normalization matches the server", () => {
  const valid = [" aapl ", "brk.b", "BRK/B", "bf.b", "ko", "BRK-B", "a1"];
  const invalid = ["", "   ", "A$$", "-AB", "AB-", "A--B", "TOOLONGTICKER", "A B", "<script>"];
  it("agrees on valid input", () => {
    for (const v of valid) expect(normalizeTickerUi(v)).toBe(normalizeTicker(v));
  });
  it("returns null exactly where the server throws", () => {
    for (const v of invalid) {
      expect(() => normalizeTicker(v)).toThrow();
      expect(normalizeTickerUi(v)).toBeNull();
    }
  });
});
