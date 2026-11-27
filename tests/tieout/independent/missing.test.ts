// QA round 2: mocked missing values -> status/rendering. Independent of tests/unit.
import { describe, it, expect } from "vitest";
import { fixtureDeps, call } from "../../helpers";
import { createFixtureFetch } from "../../../src/data/fixtureFetch";
import { formatValue } from "../../../src/ui/format";
import type { Profile, Row } from "../../../src/contracts/profile";

function mocked(edit: (facts: any) => void) {
  const base = createFixtureFetch();
  const f: any = async (url: any, init: any) => {
    const r = await (base as any)(url, init);
    if (!String(url).includes("companyfacts")) return r;
    const j = await r.json(); edit(j);
    return new Response(JSON.stringify(j), { status: 200, headers: { "content-type": "application/json" } });
  };
  return fixtureDeps({ fetch: f });
}
const row = (p: Profile, id: Row["id"]) => p.table.rows.find((r) => r.id === id)!;

describe("missing values (independent)", () => {
  it("AAPL: latest-FY operating income removed -> not reported; EBITDA not reported; derived ratios n.m.; nothing invented", async () => {
    const deps = mocked((j) => { const u = j.facts["us-gaap"].OperatingIncomeLoss.units.USD; j.facts["us-gaap"].OperatingIncomeLoss.units.USD = u.filter((x: any) => x.end !== "2026-09-26"); });
    const { res, body } = await call("AAPL", deps); expect(res.status).toBe(200); const p = body as Profile;
    const oi = row(p, "operating_income").cells[4]!;
    expect(oi.status).toBe("not-reported"); expect(oi.value).toBeNull(); expect(formatValue(oi)).toBe("not reported");
    const eb = row(p, "ebitda").cells[4]!; expect(eb.value).toBeNull(); expect(formatValue(eb)).toBe("not reported");
    for (const id of ["operating_income_growth", "operating_margin", "ebitda_growth", "ebitda_margin"] as Row["id"][]) { const c = row(p, id).cells[4]!; expect(c.value).toBeNull(); expect(c.status).toBe("n.m."); expect(formatValue(c)).toBe("n.m."); expect(c.notes?.length).toBeGreaterThan(0); }
    // earlier years untouched
    expect(row(p, "operating_income").cells[3]!.value).toBe(133_050_000_000);
    expect(row(p, "revenue").cells[4]!.value).toBe(478_834_000_000);
  });
  it("KO: D&A absent everywhere -> all five D&A and EBITDA cells not reported", async () => {
    const deps = mocked((j) => { for (const t of ["DepreciationDepletionAndAmortization", "DepreciationAndAmortization", "DepreciationAmortizationAndAccretionNet", "Depreciation", "AmortizationOfIntangibleAssets"]) delete j.facts["us-gaap"][t]; });
    const { body } = await call("KO", deps); const p = body as Profile;
    for (const id of ["da", "ebitda"] as Row["id"][]) for (const c of row(p, id).cells) { expect(c.status).toBe("not-reported"); expect(c.value).toBeNull(); expect(formatValue(c)).toBe("not reported"); }
    expect(row(p, "revenue").cells.every((c) => c.status === "reported")).toBe(true);
  });
  it("AAPL: revenue <= 0 style: zero latest revenue makes margins n.m. (no divide-by-zero / Infinity)", async () => {
    const deps = mocked((j) => { for (const x of j.facts["us-gaap"].RevenueFromContractWithCustomerExcludingAssessedTax.units.USD) if (x.end === "2026-09-26" && x.start === "2025-09-28") x.val = 0; });
    const { body } = await call("AAPL", deps); const p = body as Profile;
    for (const id of ["operating_margin", "ebitda_margin", "net_margin"] as Row["id"][]) { const c = row(p, id).cells[4]!; expect(c.value === null || Number.isFinite(c.value)).toBe(true); expect(c.status).toBe("n.m."); }
  });
});
