import { describe, expect, it } from "vitest";
import { NOT_REPORTED, ROW_LABELS, type Metric, type Profile } from "../../src/contracts/profile";
import { DA_COMPUTED_LABEL, LABELS } from "../../src/data/resolver";
import { profile, row } from "../helpers";

const TICKERS = ["AAPL", "MSFT", "KO"] as const;

function allMetrics(p: Profile): Metric[] {
  return [...p.table.rows.flatMap((r) => r.cells), p.macro.dgs10, p.macro.fedfunds];
}

describe.each(TICKERS)("%s profile contract", (t) => {
  it("every metric has sources or is not-reported / n.m.", async () => {
    const p = await profile(t);
    for (const m of allMetrics(p)) {
      if (m.status === "reported" || m.status === "computed") {
        expect(m.value, m.id).not.toBeNull();
        expect(m.sources.length, m.id).toBeGreaterThan(0);
      } else {
        expect(m.value).toBeNull();
      }
      if (m.status === "computed") expect(m.formula, m.id).toBeTruthy();
      if (m.status === "reported") expect(m.sources).toHaveLength(1);
      for (const s of m.sources) expect(s.url).toMatch(/^https:\/\/(www\.sec\.gov\/Archives\/edgar\/data\/|fred\.stlouisfed\.org\/series\/)/);
    }
  });
  it("has exact labels, 5 oldest-first years and aligned cells", async () => {
    const p = await profile(t);
    expect(row(p, "ebitda").label).toBe("EBITDA (computed: operating income + D&A)");
    expect(row(p, "total_debt").label).toBe("Total debt (incl. finance leases)");
    for (const r of p.table.rows) {
      // Data-layer labels = contract ROW_LABELS plus the round-1 finance-reviewer rulings (total debt, computed D&A).
      const computedDa = r.id === "da" && r.cells.some((c) => c.status === "computed");
      expect(r.label).toBe(computedDa ? DA_COMPUTED_LABEL : LABELS[r.id]);
      if (r.id !== "total_debt") expect(LABELS[r.id]).toBe(ROW_LABELS[r.id]);
      expect(r.cells).toHaveLength(5);
    }
    const ends = p.table.years.map((y) => y.end);
    expect([...ends].sort()).toEqual(ends);
    expect(NOT_REPORTED).toBe("not reported");
  });
  it("data-side strings use lower-case 'not reported' and every not-reported cell says where to look", async () => {
    const p = await profile(t);
    const text = JSON.stringify(p);
    expect(text).not.toContain("Not reported");
    for (const m of allMetrics(p)) if (m.status === "not-reported") expect(m.notes?.length).toBeGreaterThan(0);
  });
  it("EBITDA = operating income + D&A, growth and margins recompute from cells", async () => {
    const p = await profile(t);
    const op = row(p, "operating_income").cells;
    const da = row(p, "da").cells;
    const rev = row(p, "revenue").cells;
    row(p, "ebitda").cells.forEach((c, i) => expect(c.value).toBe(op[i]!.value! + da[i]!.value!));
    row(p, "operating_margin").cells.forEach((c, i) => expect(c.value).toBeCloseTo(op[i]!.value! / rev[i]!.value!, 12));
    const g = row(p, "revenue_growth").cells;
    for (let i = 1; i < 5; i++) expect(g[i]!.value).toBeCloseTo(rev[i]!.value! / rev[i - 1]!.value! - 1, 12);
    expect(g[0]!.status).toBe("computed"); // uses the 6th (older) year
  });
});
