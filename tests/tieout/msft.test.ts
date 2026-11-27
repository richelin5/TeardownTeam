import { describe, expect, it } from "vitest";
import { row } from "../helpers";
import { checkGolden } from "./golden";

// Tie-out: tests/tieout/MSFT-2026-11-27.md. FY24–FY26 from 10-K 0001193125-26-323660 (R2/R4/R6).
// D&A is computed (Depreciation + AmortizationOfIntangibleAssets) per docs/finance/definitions-v1.md;
// it differs from the cash-flow extension line (38,534 in FY26) by design.
describe("MSFT golden (Jun FYE)", () => {
  it("matches the filings", async () => {
    const p = await checkGolden({
      ticker: "MSFT",
      years: ["FY22 (Jun-22)", "FY23 (Jun-23)", "FY24 (Jun-24)", "FY25 (Jun-25)", "FY26 (Jun-26)"],
      values: {
        revenue: [198270, 211915, 245122, 281724, 331839],
        operating_income: [83383, 88523, 109433, 128528, 155237],
        net_income: [72738, 72361, 88136, 101832, 133749],
        da: [14600, 13500, 20000, 28000, 39000],
        ebitda: [97983, 102023, 129433, 156528, 194237],
        cash: [13931, 34704, 18315, 30242, 20935],
        total_debt: [49781, 47237, 51630, 43151, 40294],
        diluted_shares: [7540, 7472, 7469, 7465, 7453],
      },
      revenueAccn: ["0000950170-24-087843", "0000950170-25-100235", "0001193125-26-323660", "0001193125-26-323660", "0001193125-26-323660"],
    });
    expect(row(p, "da").cells.every((c) => c.status === "computed")).toBe(true);
    // FY26: LongTermDebt 40,294 = 31,067 + 9,227; no short-term debt line.
    expect(row(p, "total_debt").cells[4]!.status).toBe("reported");
  });
});
