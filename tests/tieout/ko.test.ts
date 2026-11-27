import { describe, expect, it } from "vitest";
import { row } from "../helpers";
import { checkGolden } from "./golden";

// Tie-out: tests/tieout/KO-2026-11-27.md. FY23–FY25 from 10-K 0001628280-26-010047 (R3/R5/R7).
describe("KO golden (Dec FYE; Revenues tag; post-FY23 debt tags)", () => {
  it("matches the filings", async () => {
    const p = await checkGolden({
      ticker: "KO",
      years: ["FY21 (Dec-21)", "FY22 (Dec-22)", "FY23 (Dec-23)", "FY24 (Dec-24)", "FY25 (Dec-25)"],
      values: {
        revenue: [38655, 43004, 45754, 47061, 47941],
        operating_income: [10308, 10909, 11311, 9992, 13762],
        net_income: [9771, 9542, 10714, 10631, 13107],
        da: [1452, 1260, 1128, 1075, 1050],
        ebitda: [11760, 12169, 12439, 11067, 14812],
        cash: [9684, 9519, 9366, 10828, 10270],
        total_debt: [42761, 39149, 42064, 44522, 45492],
        diluted_shares: [4340, 4350, 4339, 4320, 4313],
      },
      revenueAccn: ["0000021344-24-000009", "0000021344-25-000011", "0001628280-26-010047", "0001628280-26-010047", "0001628280-26-010047"],
    });
    expect((row(p, "revenue").cells[4]!.sources[0] as { tag: string }).tag).toBe("Revenues");
    // Finance-reviewer finding 3: lease note on every KO year; no separate FinanceLeaseLiability is added (none tagged).
    const KO_LEASE =
      "The company's debt lines include finance lease obligations (tagged LongTermDebtAndCapitalLeaseObligations from FY24; the FY23 comparative is identical under both tags).";
    for (const c of row(p, "total_debt").cells) {
      expect(c.notes).toContain(KO_LEASE);
      expect(c.sources.some((s) => s.kind === "sec" && s.tag.startsWith("FinanceLease"))).toBe(false);
    }
    expect(p.warnings.join(" ")).not.toMatch(/commercial paper exceeds/);
  });
});
