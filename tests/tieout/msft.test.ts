import { describe, expect, it } from "vitest";
import { row } from "../helpers";
import { checkGolden } from "./golden";

// Tie-out: tests/tieout/MSFT-2026-11-27.md. FY24–FY26 from 10-K 0001193125-26-323660 (R2/R4/R6).
// D&A is computed (Depreciation + AmortizationOfIntangibleAssets) per docs/finance/definitions-v1.md. It ties to its
// cited inputs but does NOT tie to the cash-flow extension line (FY24-26: 20,958 / 29,433 / 38,534; differences
// −958 / −1,433 / +466); that is disclosed on the page (row label, cell note, page warning).
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
        // Incl. finance leases (us-gaap:FinanceLeaseLiability 14,902 / 17,067 / 27,145 / 46,172 / 66,594).
        total_debt: [64683, 64304, 78775, 89323, 106888],
        diluted_shares: [7540, 7472, 7469, 7465, 7453],
      },
      revenueAccn: ["0000950170-24-087843", "0000950170-25-100235", "0001193125-26-323660", "0001193125-26-323660", "0001193125-26-323660"],
    });
    const da = row(p, "da");
    expect(da.cells.every((c) => c.status === "computed")).toBe(true);
    expect(da.label).toBe("D&A (computed: depreciation + amortization of intangibles)");
    expect(da.cells[4]!.notes?.[0]).toBe(
      "Computed: us-gaap Depreciation + AmortizationOfIntangibleAssets, both disclosed in the notes rounded to $0.1bn. The company does not tag a us-gaap D&A total. This figure does not tie to the cash-flow line 'Depreciation, amortization, and other' (company extension tag, not in standard XBRL) and can differ from it by several percent in either direction.",
    );
    expect(p.warnings.some((w) => w.startsWith("D&A is computed for FY22 (Jun-22)"))).toBe(true);
    // FY26: LongTermDebt 40,294 (31,067 + 9,227), no short-term debt line, + FinanceLeaseLiability 66,594.
    expect(row(p, "total_debt").cells[4]).toMatchObject({ status: "computed", formula: "LongTermDebt + FinanceLeaseLiability", value: 106_888_000_000 });
    expect(row(p, "cash").cells[4]!.notes?.join(" ")).toMatch(/Excludes short-term investments of \$55,908M \(us-gaap:ShortTermInvestments/);
  });
});
