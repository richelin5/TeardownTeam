import { describe, expect, it } from "vitest";
import { classify, fiscalLabel, toFiscalYear } from "../../src/data/periods";

describe("period logic", () => {
  it("classifies by duration, not fy/fp", () => {
    expect(classify(undefined, "2026-09-26")).toBe("instant");
    expect(classify("2025-09-28", "2026-09-26")).toBe("FY");
    expect(classify("2026-03-29", "2026-06-27")).toBe("Q");
    expect(classify("2025-12-28", "2026-06-27")).toBe("YTD6");
    expect(classify("2025-09-28", "2026-06-27")).toBe("YTD9");
    expect(classify("2025-07-01", "2025-12-31")).toBe("YTD6");
    expect(classify("2025-01-01", "2025-02-15")).toBe("irregular");
  });
  it("labels fiscal years from the period end", () => {
    expect(fiscalLabel("2026-09-26")).toBe("FY26 (Sep-26)");
    expect(fiscalLabel("2026-06-30")).toBe("FY26 (Jun-26)");
    expect(fiscalLabel("2025-12-31")).toBe("FY25 (Dec-25)");
  });
  it("flags 53-week years (AAPL FY23)", () => {
    expect(toFiscalYear("2022-09-25", "2023-09-30").weeks53).toBe(true);
    expect(toFiscalYear("2023-10-01", "2024-09-28").weeks53).toBe(false);
  });
});
