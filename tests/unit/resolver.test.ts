import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { computedDaNote, DA_COMPUTED_LABEL, FL_ADDED_NOTE, makeContext, NO_FL_NOTE, resolveTable } from "../../src/data/resolver";
import { trimCompanyFacts, type CompanyFacts, type Fact, type Submissions } from "../../src/data/sec";

const AAPL = "0000320193";
const MSFT = "0000789019";
const KO = "0000021344";

const load = (cik: string) => ({
  facts: JSON.parse(readFileSync(`fixtures/sec/companyfacts-CIK${cik}.json`, "utf8")) as CompanyFacts,
  sub: JSON.parse(readFileSync(`fixtures/sec/submissions-CIK${cik}.json`, "utf8")) as Submissions,
});
const resolve = (cik: string, mutate: (f: CompanyFacts, s: Submissions) => void = () => {}, sic?: string) => {
  const { facts, sub } = load(cik);
  mutate(facts, sub);
  return resolveTable(makeContext(facts, sub, cik), sic ?? sub.sic);
};
const rowOf = (t: ReturnType<typeof resolveTable>, id: string) => t.table.rows.find((r) => r.id === id)!;
const usd = (f: CompanyFacts, tag: string): Fact[] => f.facts["us-gaap"]![tag]!.units["USD"]!;
const drop = (f: CompanyFacts, tag: string) => delete f.facts["us-gaap"]![tag];

describe("resolver edge cases on real fixtures", () => {
  it("MSFT D&A is computed from Depreciation + AmortizationOfIntangibleAssets, labeled and noted as computed", () => {
    const r = resolve(MSFT);
    const da = rowOf(r, "da");
    const fy26 = da.cells[4]!;
    expect(da.label).toBe(DA_COMPUTED_LABEL);
    expect(fy26).toMatchObject({ status: "computed", value: 39_000_000_000, formula: "Depreciation + AmortizationOfIntangibleAssets", label: DA_COMPUTED_LABEL });
    expect(fy26.sources.map((s) => (s.kind === "sec" ? s.tag : ""))).toEqual(["Depreciation", "AmortizationOfIntangibleAssets"]);
    expect(fy26.notes?.[0]).toBe(computedDaNote(MSFT, true));
    expect(fy26.notes?.[0]).toMatch(/rounded to \$0\.1bn.*does not tie to the cash-flow line 'Depreciation, amortization, and other'/);
    expect(rowOf(r, "ebitda").cells[4]!.formula).toBe("OperatingIncomeLoss + (Depreciation + AmortizationOfIntangibleAssets)");
    expect(rowOf(r, "ebitda").cells[4]!.notes).toContain(computedDaNote(MSFT, true));
    expect(r.warnings.filter((w) => w.startsWith("D&A is computed"))).toHaveLength(1);
    expect(r.warnings.some((w) => w.includes("mixes methods"))).toBe(false);
  });

  it("computed D&A note says 'may be rounded' unless both inputs are multiples of $100M, and is generic for unknown filers", () => {
    expect(computedDaNote(AAPL, false)).toMatch(/\(values may be rounded\)/);
    expect(computedDaNote(AAPL, false)).not.toMatch(/0\.1bn|Depreciation, amortization, and other/);
    expect(computedDaNote(AAPL, false)).toMatch(/cash-flow statement's D&A line/);
  });

  it("D&A mixing reported and computed years: computed label, page warning and EBITDA growth note", () => {
    // AAPL FY26 without its us-gaap D&A total falls back to Depreciation 8,700 + AmortizationOfIntangibleAssets 4,900.
    const r = resolve(AAPL, (f) => {
      const dda = f.facts["us-gaap"]!["DepreciationDepletionAndAmortization"]!.units["USD"]!;
      f.facts["us-gaap"]!["DepreciationDepletionAndAmortization"]!.units["USD"] = dda.filter((x) => x.end !== "2026-09-26");
    });
    const da = rowOf(r, "da");
    expect(da.label).toBe(DA_COMPUTED_LABEL);
    expect(da.cells.map((c) => c.status)).toEqual(["reported", "reported", "reported", "reported", "computed"]);
    expect(da.cells[4]!.value).toBe(13_600_000_000);
    expect(da.cells[3]!.label).toBe("D&A");
    expect(r.warnings.some((w) => w.startsWith("The D&A row mixes methods across years") && w.includes("computed (Depreciation + AmortizationOfIntangibleAssets) for FY26 (Sep-26)"))).toBe(true);
    expect(rowOf(r, "ebitda_growth").cells[4]!.notes).toContain("Not like-for-like: D&A is reported in FY25 (Sep-25) and computed in FY26 (Sep-26)");
    expect(rowOf(r, "ebitda_growth").cells[3]!.notes ?? []).toHaveLength(0);
  });

  it("a missing tag yields 'not reported' with a filing link; EBITDA follows; growth/margins are n.m. with a reason", () => {
    const r = resolve(MSFT, (f) => drop(f, "AmortizationOfIntangibleAssets"));
    const da = rowOf(r, "da");
    expect(da.label).toBe("D&A");
    expect(da.cells.every((c) => c.status === "not-reported" && c.value === null)).toBe(true);
    expect(da.cells[4]!.notes).toEqual(["Not tagged in standard XBRL; see filing: https://www.sec.gov/Archives/edgar/data/789019/000119312526323660/msft-20260630.htm"]);
    expect(rowOf(r, "ebitda").cells.every((c) => c.status === "not-reported")).toBe(true);
    const margin = rowOf(r, "ebitda_margin").cells[4]!;
    expect(margin).toMatchObject({ status: "n.m.", value: null, notes: ["n.m.: needs FY26 (Jun-26) EBITDA (not reported)."] });
    const growth = rowOf(r, "ebitda_growth").cells[4]!;
    expect(growth).toMatchObject({ status: "n.m.", notes: ["n.m.: needs FY26 (Jun-26) and prior-year EBITDA; it is not reported."] });
    expect(JSON.stringify(r)).not.toContain("Not reported");
  });

  it("growth needing a prior year that is missing is n.m. 'needs prior-year revenue'", () => {
    const r = resolve(KO, (f) => {
      // Keep only facts for the five shown years (FY21-FY25) so FY21 has no prior year.
      for (const c of Object.values(f.facts["us-gaap"]!)) for (const u of Object.keys(c.units)) c.units[u] = c.units[u]!.filter((x) => x.end >= "2021-12-31");
    });
    expect(r.table.years[0]!.label).toBe("FY21 (Dec-21)");
    expect(rowOf(r, "revenue_growth").cells[0]).toMatchObject({
      status: "n.m.",
      notes: ["n.m.: needs prior-year revenue (no earlier fiscal year in the 10-K data)."],
    });
  });

  it("growth across non-consecutive fiscal years is n.m.", () => {
    // Remove KO FY23 entirely: FY24 growth would compare against FY22.
    const r = resolve(KO, (f) => {
      for (const c of Object.values(f.facts["us-gaap"]!)) for (const u of Object.keys(c.units)) c.units[u] = c.units[u]!.filter((x) => x.end !== "2023-12-31");
    });
    const labels = r.table.years.map((y) => y.label);
    const j = labels.indexOf("FY24 (Dec-24)");
    expect(labels[j - 1]).toBe("FY22 (Dec-22)");
    for (const id of ["revenue_growth", "operating_income_growth", "ebitda_growth", "net_income_growth"]) {
      expect(rowOf(r, id).cells[j]).toMatchObject({ status: "n.m.", value: null, notes: ["n.m.: non-consecutive fiscal years (FY22 (Dec-22) to FY24 (Dec-24))."] });
    }
    expect(rowOf(r, "revenue_growth").cells[j + 1]!.status).toBe("computed");
  });

  it("growth is n.m. when the prior value is <= 0", () => {
    const r = resolve(KO, (f) => {
      for (const x of usd(f, "OperatingIncomeLoss")) if (x.end === "2024-12-31" && x.start === "2024-01-01") x.val = -x.val;
    });
    expect(rowOf(r, "operating_income_growth").cells[4]).toMatchObject({ status: "n.m.", value: null });
  });

  it("53-week year: flagged, warned, and noted on the growth cells that touch it", () => {
    const r = resolve(AAPL);
    expect(r.table.years.map((y) => y.weeks53)).toEqual([false, true, false, false, false]);
    expect(r.warnings.join()).toMatch(/53-week/);
    const note = "Not like-for-like: FY23 (Sep-23) is a 53-week year";
    for (const id of ["revenue_growth", "operating_income_growth", "ebitda_growth", "net_income_growth"]) {
      expect(rowOf(r, id).cells.map((c) => (c.notes ?? []).includes(note))).toEqual([false, true, true, false, false]);
    }
    expect((rowOf(r, "operating_margin").cells[1]!.notes ?? []).includes(note)).toBe(false);
  });

  it("financial institutions: EBITDA, EBITDA growth and EBITDA margin are n.m. (not 'not reported')", () => {
    const r = resolve(KO, () => {}, "6021");
    for (const id of ["ebitda", "ebitda_growth", "ebitda_margin"]) {
      for (const c of rowOf(r, id).cells) {
        expect(c).toMatchObject({ status: "n.m.", value: null, notes: ["n.m.: EBITDA is not meaningful for financial institutions."] });
        expect(c.formula).toBeUndefined();
      }
    }
    expect(rowOf(r, "operating_margin").cells[4]!.status).toBe("computed");
  });

  it("NetIncomeLossAvailableToCommonStockholdersBasic fallback carries the preferred-dividends note", () => {
    const r = resolve(KO, (f) => {
      const g = f.facts["us-gaap"]!;
      g["NetIncomeLossAvailableToCommonStockholdersBasic"] = g["NetIncomeLoss"]!;
      delete g["NetIncomeLoss"];
    });
    const c = rowOf(r, "net_income").cells[4]!;
    expect(c.sources[0]).toMatchObject({ tag: "NetIncomeLossAvailableToCommonStockholdersBasic", fallbackRank: 1 });
    expect(c.notes).toContain("After preferred dividends; not net income attributable to the parent.");
  });
});

describe("total debt incl. finance leases (finance-reviewer findings 2-4)", () => {
  it("AAPL adds FinanceLeaseLiability as a separate source: FY26 81,567", () => {
    const c = rowOf(resolve(AAPL), "total_debt").cells[4]!;
    expect(c.label).toBe("Total debt (incl. finance leases)");
    expect(c.value).toBe(81_567_000_000); // 78,114 + 1,997 + 1,456
    expect(c.sources.map((s) => (s.kind === "sec" ? [s.tag, s.fallbackRank, s.value] : []))).toEqual([
      ["LongTermDebt", 0, 78_114_000_000],
      ["CommercialPaper", 2, 1_997_000_000],
      ["FinanceLeaseLiability", 0, 1_456_000_000],
    ]);
    expect(c.notes).toContain(`${FL_ADDED_NOTE} (us-gaap:FinanceLeaseLiability).`);
    expect(c.notes).toContain("Excludes operating lease liabilities.");
  });

  it("falls back to FinanceLeaseLiabilityCurrent + Noncurrent when the total is not tagged", () => {
    const c = rowOf(resolve(AAPL, (f) => drop(f, "FinanceLeaseLiability")), "total_debt").cells[4]!;
    expect(c.value).toBe(81_567_000_000); // 700 + 756 = 1,456
    expect(c.formula).toBe("LongTermDebt + CommercialPaper + FinanceLeaseLiabilityCurrent + FinanceLeaseLiabilityNoncurrent");
    expect(c.sources.slice(2).map((s) => (s.kind === "sec" ? s.fallbackRank : -1))).toEqual([1, 1]);
    expect(c.notes).toContain(`${FL_ADDED_NOTE} (us-gaap:FinanceLeaseLiabilityCurrent + us-gaap:FinanceLeaseLiabilityNoncurrent).`);
  });

  it("MSFT FY26 106,888 = LongTermDebt 40,294 + FinanceLeaseLiability 66,594", () => {
    const c = rowOf(resolve(MSFT), "total_debt").cells[4]!;
    expect(c).toMatchObject({ value: 106_888_000_000, status: "computed", formula: "LongTermDebt + FinanceLeaseLiability" });
  });

  it("says so when no finance lease liability is tagged (value unchanged, never guessed)", () => {
    const c = rowOf(resolve(MSFT, (f) => drop(f, "FinanceLeaseLiability")), "total_debt").cells[4]!;
    expect(c).toMatchObject({ value: 40_294_000_000, status: "reported" });
    expect(c.notes).toContain(NO_FL_NOTE);
  });

  it("KO: debt lines already include finance leases; loans & notes payable, never CP again; FY25 45,492", () => {
    const r = resolve(KO);
    const cells = rowOf(r, "total_debt").cells;
    expect(cells[4]!.value).toBe(45_492_000_000);
    expect(cells[4]!.formula).toBe("LongTermDebtAndCapitalLeaseObligations + LongTermDebtAndCapitalLeaseObligationsCurrent + NotesAndLoansPayable");
    // FY23 uses LongTermDebt 37,507, verified equal to 35,547 + 1,960 under the capital-lease tags: nothing added.
    expect(cells[2]!.value).toBe(42_064_000_000);
    const note =
      "The company's debt lines include finance lease obligations (tagged LongTermDebtAndCapitalLeaseObligations from FY24; the FY23 comparative is identical under both tags).";
    for (const c of cells) {
      expect(c.notes).toContain(note);
      expect(c.notes).not.toContain(NO_FL_NOTE);
      expect(c.sources.some((s) => s.kind === "sec" && s.tag === "CommercialPaper")).toBe(false);
    }
    expect(r.warnings.some((w) => /commercial paper/i.test(w))).toBe(false);
  });

  it("KO comparative that differs under the two tags is disclosed and warned", () => {
    const r = resolve(KO, (f) => {
      for (const x of usd(f, "LongTermDebtAndCapitalLeaseObligations")) if (x.end === "2023-12-31") x.val -= 1e8;
    });
    expect(rowOf(r, "total_debt").cells[4]!.notes?.[0]).toMatch(/the FY23 comparative differs under the two tags: LongTermDebt \$37,507M vs \$37,407M; see filing/);
    expect(r.warnings.some((w) => w.startsWith("Total debt FY23 (Dec-23): LongTermDebt and LongTermDebtAndCapitalLeaseObligations differ"))).toBe(true);
  });

  it("warns when commercial paper exceeds the chosen loans & notes payable line (subset assumption broken)", () => {
    const r = resolve(KO, (f) => {
      for (const x of usd(f, "CommercialPaper")) if (x.end === "2025-12-31") x.val = 2_000_000_000; // > 1,551
    });
    const c = rowOf(r, "total_debt").cells[4]!;
    expect(c.value).toBe(45_492_000_000);
    expect(c.notes?.some((n) => n.startsWith("Check: commercial paper ($2,000M, us-gaap:CommercialPaper") && n.includes("us-gaap:NotesAndLoansPayable"))).toBe(true);
    expect(r.warnings.some((w) => w.startsWith("Total debt FY25 (Dec-25): commercial paper exceeds us-gaap:NotesAndLoansPayable"))).toBe(true);
  });
});

describe("cash note quantifies excluded short-term investments (finding 5)", () => {
  it.each([
    [MSFT, 4, "Excludes short-term investments of $55,908M (us-gaap:ShortTermInvestments, 0001193125-26-323660)."],
    [AAPL, 4, "Excludes current marketable securities of $20,417M (us-gaap:MarketableSecuritiesCurrent, 0000320193-26-000026)."],
    [KO, 4, "Excludes short-term investments of $3,602M (us-gaap:OtherShortTermInvestments, 0001628280-26-010047)."],
  ])("%s", (cik, i, note) => {
    const c = rowOf(resolve(cik), "cash").cells[i]!;
    expect(c.status).toBe("reported");
    expect(c.sources).toHaveLength(1);
    expect(c.notes).toContain(note);
  });
});

describe("trimmed companyfacts (security L1)", () => {
  it.each([AAPL, MSFT, KO])("%s resolves identically from the trimmed full raw companyfacts and from the fixture", (cik) => {
    const raw = JSON.parse(gunzipSync(readFileSync(`fixtures/sec/raw/companyfacts-CIK${cik}.json.gz`)).toString("utf8")) as CompanyFacts;
    const { facts, sub } = load(cik);
    const fromRaw = resolveTable(makeContext(trimCompanyFacts(raw), sub, cik), sub.sic);
    const fromFixture = resolveTable(makeContext(facts, sub, cik), sub.sic);
    expect(fromRaw).toEqual(fromFixture);
  });
});
