import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { makeContext, resolveTable } from "../../src/data/resolver";
import type { CompanyFacts, Submissions } from "../../src/data/sec";

const load = (cik: string) => ({
  facts: JSON.parse(readFileSync(`fixtures/sec/companyfacts-CIK${cik}.json`, "utf8")) as CompanyFacts,
  sub: JSON.parse(readFileSync(`fixtures/sec/submissions-CIK${cik}.json`, "utf8")) as Submissions,
});
const rowOf = (t: ReturnType<typeof resolveTable>, id: string) => t.table.rows.find((r) => r.id === id)!;

describe("resolver edge cases on real fixtures", () => {
  it("MSFT D&A is computed from Depreciation + AmortizationOfIntangibleAssets with a note", () => {
    const { facts, sub } = load("0000789019");
    const r = resolveTable(makeContext(facts, sub, "0000789019"), sub.sic);
    const fy26 = rowOf(r, "da").cells[4]!;
    expect(fy26).toMatchObject({ status: "computed", value: 39_000_000_000, formula: "Depreciation + AmortizationOfIntangibleAssets" });
    expect(fy26.sources.map((s) => (s.kind === "sec" ? s.tag : ""))).toEqual(["Depreciation", "AmortizationOfIntangibleAssets"]);
    expect(fy26.notes?.join(" ")).toMatch(/extension tag/);
    expect(rowOf(r, "ebitda").cells[4]!.formula).toBe("OperatingIncomeLoss + (Depreciation + AmortizationOfIntangibleAssets)");
  });

  it("a missing tag yields 'not reported' and EBITDA follows (never a guess)", () => {
    const { facts, sub } = load("0000789019");
    const usgaap = facts.facts["us-gaap"]!;
    delete usgaap["AmortizationOfIntangibleAssets"];
    const r = resolveTable(makeContext(facts, sub, "0000789019"), sub.sic);
    expect(rowOf(r, "da").cells.every((c) => c.status === "not-reported" && c.value === null)).toBe(true);
    expect(rowOf(r, "ebitda").cells.every((c) => c.status === "not-reported")).toBe(true);
    expect(rowOf(r, "ebitda_margin").cells.every((c) => c.status === "not-reported")).toBe(true);
  });

  it("growth is n.m. when the prior value is <= 0", () => {
    const { facts, sub } = load("0000021344");
    const oi = facts.facts["us-gaap"]!["OperatingIncomeLoss"]!.units["USD"]!;
    for (const f of oi) if (f.end === "2024-12-31" && f.start === "2024-01-01") f.val = -f.val;
    const r = resolveTable(makeContext(facts, sub, "0000021344"), sub.sic);
    expect(rowOf(r, "operating_income_growth").cells[4]).toMatchObject({ status: "n.m.", value: null });
  });

  it("KO total debt uses loans & notes payable, never adds commercial paper again", () => {
    const { facts, sub } = load("0000021344");
    const r = resolveTable(makeContext(facts, sub, "0000021344"), sub.sic);
    const fy25 = rowOf(r, "total_debt").cells[4]!;
    expect(fy25.value).toBe(45_492_000_000);
    expect(fy25.formula).toBe("LongTermDebtAndCapitalLeaseObligations + LongTermDebtAndCapitalLeaseObligationsCurrent + NotesAndLoansPayable");
    expect(fy25.sources.some((s) => s.kind === "sec" && s.tag === "CommercialPaper")).toBe(false);
  });

  it("financial institutions get EBITDA n.m.", () => {
    const { facts, sub } = load("0000021344");
    const r = resolveTable(makeContext(facts, sub, "0000021344"), "6021");
    expect(rowOf(r, "ebitda").cells.every((c) => c.status === "n.m.")).toBe(true);
  });

  it("flags AAPL FY23 as a 53-week year", () => {
    const { facts, sub } = load("0000320193");
    const r = resolveTable(makeContext(facts, sub, "0000320193"), sub.sic);
    expect(r.table.years.map((y) => y.weeks53)).toEqual([false, true, false, false, false]);
    expect(r.warnings.join()).toMatch(/53-week/);
  });
});
