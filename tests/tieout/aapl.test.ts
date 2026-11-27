import { describe, expect, it } from "vitest";
import { row } from "../helpers";
import { checkGolden } from "./golden";

// Tie-out: tests/tieout/AAPL-2026-11-27.md. FY24–FY26 from 10-K 0000320193-26-000026 (R3/R5/R8);
// older years from each fact's own 10-K (accn noted in the report).
describe("AAPL golden (Sep FYE, 53-week FY23)", () => {
  it("matches the filings", async () => {
    const p = await checkGolden({
      ticker: "AAPL",
      years: ["FY22 (Sep-22)", "FY23 (Sep-23)", "FY24 (Sep-24)", "FY25 (Sep-25)", "FY26 (Sep-26)"],
      values: {
        revenue: [394328, 383285, 391035, 416161, 478834],
        operating_income: [119437, 114301, 123216, 133050, 158063],
        net_income: [99803, 96995, 93736, 112010, 132175],
        da: [11104, 11519, 11445, 11698, 13423],
        ebitda: [130541, 125820, 134661, 144748, 171486],
        cash: [23646, 29965, 29943, 35934, 36305],
        total_debt: [120069, 111088, 106629, 98657, 80111],
        diluted_shares: [16325.819, 15812.547, 15408.095, 15004.697, 14720.306],
      },
      revenueAccn: ["0000320193-24-000123", "0000320193-25-000079", "0000320193-26-000026", "0000320193-26-000026", "0000320193-26-000026"],
    });
    // FY26 total debt = LongTermDebt 78,114 (68,208 + 9,906) + CommercialPaper 1,997
    expect(row(p, "total_debt").cells[4]!.formula).toBe("LongTermDebt + CommercialPaper");
    expect(p.table.years[1]!.weeks53).toBe(true);
    expect(row(p, "revenue_growth").cells[4]!.value).toBeCloseTo(478834 / 416161 - 1, 10);
  });
});
