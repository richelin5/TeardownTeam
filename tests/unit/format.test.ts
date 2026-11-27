import { describe, expect, it } from "vitest";
import type { Metric } from "../../src/contracts/profile";
import { formatLong, formatValue, safeUrl } from "../../src/ui/format";

const m = (over: Partial<Metric>): Metric => ({ id: "x", label: "x", value: 0, unit: "USD", status: "reported", sources: [], ...over });

describe("formatting", () => {
  it("formats $ in millions with parentheses for negatives", () => {
    expect(formatValue(m({ value: 478_834_000_000 }))).toBe("478,834");
    expect(formatValue(m({ value: -1_234_000_000 }))).toBe("(1,234)");
    expect(formatLong(m({ value: -1_234_000_000 }))).toBe("($1,234M)");
    expect(formatLong(m({ value: 1_234_000_000 }))).toBe("$1,234M");
  });
  it("formats ratios to 1 decimal and rates to 2", () => {
    expect(formatValue(m({ unit: "ratio", value: 0.15058 }))).toBe("15.1%");
    expect(formatValue(m({ unit: "ratio", value: -0.0282 }))).toBe("(2.8%)");
    expect(formatValue(m({ unit: "percent", value: 4.91 }))).toBe("4.91%");
  });
  it("uses the exact 'not reported' wording and n.m.", () => {
    expect(formatValue(m({ value: null, status: "not-reported" }))).toBe("not reported");
    expect(formatValue(m({ value: null, status: "n.m.", unit: "ratio" }))).toBe("n.m.");
  });
  it("only allows official https SEC/FRED links", () => {
    expect(safeUrl("https://www.sec.gov/Archives/x")).toBe("https://www.sec.gov/Archives/x");
    expect(safeUrl("https://fred.stlouisfed.org/series/DGS10")).not.toBeNull();
    expect(safeUrl("javascript:alert(1)")).toBeNull();
    expect(safeUrl("https://www.sec.gov.evil.com/")).toBeNull();
    expect(safeUrl("http://www.sec.gov/")).toBeNull();
  });
});
