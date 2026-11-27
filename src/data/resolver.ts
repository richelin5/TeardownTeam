/**
 * Pure resolver: (companyfacts, submissions) → 5-FY financial table with provenance.
 * No network. Rules: xbrl-mapping skill + docs/finance/definitions-v1.md.
 */
import {
  NOT_REPORTED,
  ROW_LABELS,
  type FinancialTable,
  type FiscalYear,
  type Metric,
  type MetricUnit,
  type Row,
  type SecSource,
} from "../contracts/profile";
import { classify, isAnnualForm, toFiscalYear } from "./periods";
import { filingUrl, type CompanyFacts, type Fact, type Submissions } from "./sec";
import { CHAINS, TAG_NOTES } from "./tagChains";

export const YEARS_SHOWN = 5;
const RESTATEMENT_THRESHOLD = 0.005;

type Picked = { tag: string; rank: number; fact: Fact; notes: string[] };

export type ResolveContext = {
  facts: CompanyFacts;
  cik10: string;
  /** accn → primaryDocument, from submissions.filings.recent */
  primaryDocs: Map<string, string>;
};

export function makeContext(facts: CompanyFacts, submissions: Submissions, cik10: string): ResolveContext {
  const r = submissions.filings.recent;
  const primaryDocs = new Map<string, string>();
  r.accessionNumber.forEach((a, i) => {
    const doc = r.primaryDocument[i];
    if (doc) primaryDocs.set(a, doc);
  });
  return { facts, cik10, primaryDocs };
}

function unitFacts(ctx: ResolveContext, tag: string, unit: "USD" | "shares"): Fact[] {
  return ctx.facts.facts["us-gaap"]?.[tag]?.units[unit] ?? [];
}

/** Latest-filed 10-K fact for an exact period; adds a restatement note when older values differ > 0.5%. */
function pickFact(ctx: ResolveContext, tag: string, unit: "USD" | "shares", year: FiscalYear, instant: boolean): { fact: Fact; notes: string[] } | null {
  const matches = unitFacts(ctx, tag, unit).filter(
    (f) =>
      isAnnualForm(f.form) &&
      Number.isFinite(f.val) &&
      f.end === year.end &&
      (instant ? f.start === undefined : f.start === year.start),
  );
  if (matches.length === 0) return null;
  matches.sort((a, b) => (a.filed < b.filed ? 1 : a.filed > b.filed ? -1 : 0));
  const best = matches[0]!;
  const notes: string[] = [];
  const restated = matches.find(
    (m) => m.accn !== best.accn && Math.abs(m.val - best.val) > Math.abs(best.val) * RESTATEMENT_THRESHOLD,
  );
  if (restated) {
    notes.push(
      `Restated: the latest filing (${best.accn}) differs from an earlier filing (${restated.accn}, value ${restated.val}). The latest-filed value is shown.`,
    );
  }
  return { fact: best, notes };
}

function pickChain(ctx: ResolveContext, chain: readonly string[], unit: "USD" | "shares", year: FiscalYear, instant: boolean): Picked | null {
  for (let rank = 0; rank < chain.length; rank++) {
    const tag = chain[rank]!;
    const hit = pickFact(ctx, tag, unit, year, instant);
    if (hit) {
      const notes = [...hit.notes];
      if (TAG_NOTES[tag]) notes.push(TAG_NOTES[tag]!);
      return { tag, rank, fact: hit.fact, notes };
    }
  }
  return null;
}

function toSource(ctx: ResolveContext, p: Picked): SecSource {
  return {
    kind: "sec",
    taxonomy: "us-gaap",
    tag: p.tag,
    fallbackRank: p.rank,
    accn: p.fact.accn,
    form: p.fact.form,
    filed: p.fact.filed,
    url: filingUrl(ctx.cik10, p.fact.accn, ctx.primaryDocs.get(p.fact.accn)),
    ...(p.fact.start ? { periodStart: p.fact.start } : {}),
    periodEnd: p.fact.end,
    value: p.fact.val,
  };
}

const notReported = (id: string, label: string, unit: MetricUnit, note: string, sources: SecSource[] = []): Metric => ({
  id,
  label,
  value: null,
  unit,
  status: "not-reported",
  sources,
  notes: [note],
});

const NOT_TAGGED = "Not tagged in standard us-gaap XBRL for this fiscal year; see the filing.";

function reportedMetric(ctx: ResolveContext, id: string, label: string, unit: MetricUnit, p: Picked): Metric {
  return { id, label, value: p.fact.val, unit, status: "reported", sources: [toSource(ctx, p)], ...(p.notes.length ? { notes: p.notes } : {}) };
}

function simpleMetric(ctx: ResolveContext, id: Row["id"], chain: readonly string[], unit: "USD" | "shares", year: FiscalYear, instant: boolean): Metric {
  const p = pickChain(ctx, chain, unit, year, instant);
  return p ? reportedMetric(ctx, id, ROW_LABELS[id], unit === "USD" ? "USD" : "shares", p) : notReported(id, ROW_LABELS[id], unit, NOT_TAGGED);
}

export const MSFT_STYLE_DA_NOTE =
  "Computed: Depreciation + Amortization of intangible assets (note disclosures, which may be rounded). The company does not tag a us-gaap D&A total; a cash-flow line using a company extension tag (e.g. 'Depreciation, amortization, and other') is not used.";

function daMetric(ctx: ResolveContext, year: FiscalYear): Metric {
  const total = pickChain(ctx, CHAINS.da, "USD", year, false);
  if (total) return reportedMetric(ctx, "da", ROW_LABELS.da, "USD", total);
  const dep = pickChain(ctx, ["Depreciation"], "USD", year, false);
  const amort = pickChain(ctx, ["AmortizationOfIntangibleAssets"], "USD", year, false);
  if (dep && amort) {
    const ranked = (p: Picked): Picked => ({ ...p, rank: CHAINS.da.length });
    return {
      id: "da",
      label: ROW_LABELS.da,
      value: dep.fact.val + amort.fact.val,
      unit: "USD",
      status: "computed",
      sources: [toSource(ctx, ranked(dep)), toSource(ctx, ranked(amort))],
      formula: "Depreciation + AmortizationOfIntangibleAssets",
      notes: [MSFT_STYLE_DA_NOTE, ...dep.notes, ...amort.notes],
    };
  }
  return notReported("da", ROW_LABELS.da, "USD", NOT_TAGGED);
}

function totalDebtMetric(ctx: ResolveContext, year: FiscalYear): Metric {
  const label = ROW_LABELS.total_debt;
  const parts: Picked[] = [];
  const notes: string[] = [];
  const direct = pickChain(ctx, CHAINS.debt_total_direct, "USD", year, true);
  if (direct) {
    parts.push(direct);
  } else {
    const nc = pickChain(ctx, CHAINS.debt_noncurrent, "USD", year, true);
    const cur = pickChain(ctx, CHAINS.debt_current, "USD", year, true);
    if (!nc || !cur) {
      return notReported("total_debt", label, "USD", "Long-term debt (non-current and current) is not fully tagged in standard us-gaap XBRL at this date; see the filing.");
    }
    parts.push(nc, cur);
  }
  const st = pickChain(ctx, CHAINS.st_borrowings, "USD", year, true);
  if (st) parts.push(st);
  else notes.push("No short-term borrowings (notes payable, short-term borrowings or commercial paper) tagged at this date.");
  for (const p of parts) notes.push(...p.notes);
  notes.push("Excludes operating lease liabilities.");
  const value = parts.reduce((s, p) => s + p.fact.val, 0);
  const sources = parts.map((p) => toSource(ctx, p));
  if (parts.length === 1) {
    return { id: "total_debt", label, value, unit: "USD", status: "reported", sources, notes: dedupe(notes) };
  }
  return {
    id: "total_debt",
    label,
    value,
    unit: "USD",
    status: "computed",
    sources,
    formula: parts.map((p) => p.tag).join(" + "),
    notes: dedupe(notes),
  };
}

function ebitdaMetric(op: Metric, da: Metric): Metric {
  const label = ROW_LABELS.ebitda;
  const sources = [...op.sources, ...da.sources].filter((s): s is SecSource => s.kind === "sec");
  if (op.value === null || da.value === null) {
    return notReported("ebitda", label, "USD", `EBITDA needs both operating income and D&A; ${op.value === null ? "operating income" : "D&A"} is ${NOT_REPORTED}.`, sources);
  }
  return {
    id: "ebitda",
    label,
    value: op.value + da.value,
    unit: "USD",
    status: "computed",
    sources,
    formula: `OperatingIncomeLoss + ${da.formula ? `(${da.formula})` : (da.sources[0] as SecSource).tag}`,
    notes: ["Unadjusted: no add-backs for stock-based compensation, restructuring or impairments.", ...(da.notes ?? [])],
  };
}

function growthMetric(id: Row["id"], base: string, cur: Metric, prior: Metric | undefined, curYear: FiscalYear, priorYear: FiscalYear | undefined): Metric {
  const label = ROW_LABELS[id];
  if (!prior || !priorYear) return notReported(id, label, "ratio", `Needs the prior fiscal year, which is ${NOT_REPORTED} in the 10-K data.`);
  const sources = [...cur.sources, ...prior.sources];
  if (cur.value === null || prior.value === null) {
    return notReported(id, label, "ratio", `Needs ${base} for ${curYear.label} and ${priorYear.label}; one is ${NOT_REPORTED}.`, sources as SecSource[]);
  }
  const formula = `${base} ${curYear.label} / ${base} ${priorYear.label} − 1`;
  if (prior.value <= 0) {
    return { id, label, value: null, unit: "ratio", status: "n.m.", sources, formula, notes: ["n.m.: prior-year value is zero or negative."] };
  }
  return { id, label, value: cur.value / prior.value - 1, unit: "ratio", status: "computed", sources, formula };
}

function marginMetric(id: Row["id"], base: string, num: Metric, rev: Metric, year: FiscalYear): Metric {
  const label = ROW_LABELS[id];
  const sources = [...num.sources, ...rev.sources];
  if (num.value === null || rev.value === null) {
    return notReported(id, label, "ratio", `Needs ${base} and revenue for ${year.label}; one is ${NOT_REPORTED}.`, sources as SecSource[]);
  }
  const formula = `${base} / Revenue (${year.label})`;
  if (rev.value <= 0) {
    return { id, label, value: null, unit: "ratio", status: "n.m.", sources, formula, notes: ["n.m.: revenue is zero or negative."] };
  }
  return { id, label, value: num.value / rev.value, unit: "ratio", status: "computed", sources, formula };
}

function dedupe(xs: string[]): string[] {
  return [...new Set(xs)];
}

/** Fiscal years = distinct FY-duration periods in 10-K facts for revenue / operating income / net income, newest first. */
export function discoverFiscalYears(ctx: ResolveContext, max: number): FiscalYear[] {
  const byEnd = new Map<string, { start: string; filed: string }>();
  const tags = [...CHAINS.revenue, ...CHAINS.operating_income, ...CHAINS.net_income];
  for (const tag of tags) {
    for (const f of unitFacts(ctx, tag, "USD")) {
      if (!isAnnualForm(f.form) || !f.start || classify(f.start, f.end) !== "FY") continue;
      const prev = byEnd.get(f.end);
      if (!prev || f.filed > prev.filed) byEnd.set(f.end, { start: f.start, filed: f.filed });
    }
  }
  const ends = [...byEnd.keys()].sort().reverse();
  const years: FiscalYear[] = [];
  for (const end of ends) {
    // Skip overlapping duplicates (e.g. a re-cut period ending within ~300 days of a kept year).
    if (years.some((y) => Math.abs(Date.parse(y.end) - Date.parse(end)) < 300 * 86_400_000)) continue;
    years.push(toFiscalYear(byEnd.get(end)!.start, end));
    if (years.length >= max) break;
  }
  return years;
}

export type ResolveResult = { table: FinancialTable; warnings: string[] };

export function resolveTable(ctx: ResolveContext, sic: string): ResolveResult {
  const warnings: string[] = [];
  // One extra (older) year so the oldest shown year has a growth rate.
  const allYears = discoverFiscalYears(ctx, YEARS_SHOWN + 1).reverse(); // oldest first
  const shown = allYears.slice(-YEARS_SHOWN);
  const offset = allYears.length - shown.length;
  if (shown.length < YEARS_SHOWN) warnings.push(`Only ${shown.length} fiscal year(s) of 10-K data are available.`);

  const per = allYears.map((y) => {
    const revenue = simpleMetric(ctx, "revenue", CHAINS.revenue, "USD", y, false);
    const operating_income = simpleMetric(ctx, "operating_income", CHAINS.operating_income, "USD", y, false);
    const net_income = simpleMetric(ctx, "net_income", CHAINS.net_income, "USD", y, false);
    const da = daMetric(ctx, y);
    const ebitda = ebitdaMetric(operating_income, da);
    return {
      revenue,
      operating_income,
      net_income,
      da,
      ebitda,
      cash: simpleMetric(ctx, "cash", CHAINS.cash, "USD", y, true),
      total_debt: totalDebtMetric(ctx, y),
      diluted_shares: simpleMetric(ctx, "diluted_shares", CHAINS.diluted_shares, "shares", y, false),
    };
  });

  const isFinancial = /^(602\d|63\d\d)$/.test(sic);
  if (isFinancial) {
    for (const p of per) {
      p.ebitda = { ...p.ebitda, value: null, status: "n.m.", notes: ["n.m.: EBITDA is not meaningful for financial institutions."] };
    }
  }

  // Sanity checks (fail closed for revenue <= 0 in non-financials).
  per.forEach((p, i) => {
    if (!isFinancial && p.revenue.value !== null && p.revenue.value <= 0) {
      warnings.push(`Revenue for ${allYears[i]!.label} is zero or negative; it is shown as not reported.`);
      p.revenue = notReported("revenue", ROW_LABELS.revenue, "USD", "Failed sanity check (revenue ≤ 0).");
    }
  });

  const valueRow = (id: keyof (typeof per)[number], unit: MetricUnit): Row => ({
    id,
    label: ROW_LABELS[id],
    kind: "value",
    unit,
    cells: per.slice(offset).map((p) => p[id]),
  });
  const growthRow = (id: Row["id"], key: "revenue" | "operating_income" | "ebitda" | "net_income", base: string): Row => ({
    id,
    label: ROW_LABELS[id],
    kind: "growth",
    unit: "ratio",
    cells: shown.map((y, j) => {
      const i = j + offset;
      return growthMetric(id, base, per[i]![key], i > 0 ? per[i - 1]![key] : undefined, y, i > 0 ? allYears[i - 1] : undefined);
    }),
  });
  const marginRow = (id: Row["id"], key: "operating_income" | "ebitda" | "net_income", base: string): Row => ({
    id,
    label: ROW_LABELS[id],
    kind: "margin",
    unit: "ratio",
    cells: shown.map((y, j) => marginMetric(id, base, per[j + offset]![key], per[j + offset]!.revenue, y)),
  });

  const rows: Row[] = [
    valueRow("revenue", "USD"),
    growthRow("revenue_growth", "revenue", "Revenue"),
    valueRow("operating_income", "USD"),
    growthRow("operating_income_growth", "operating_income", "Operating income"),
    marginRow("operating_margin", "operating_income", "Operating income"),
    valueRow("da", "USD"),
    valueRow("ebitda", "USD"),
    growthRow("ebitda_growth", "ebitda", "EBITDA"),
    marginRow("ebitda_margin", "ebitda", "EBITDA"),
    valueRow("net_income", "USD"),
    growthRow("net_income_growth", "net_income", "Net income"),
    marginRow("net_margin", "net_income", "Net income"),
    valueRow("cash", "USD"),
    valueRow("total_debt", "USD"),
    valueRow("diluted_shares", "shares"),
  ];

  for (const row of rows.filter((r) => r.kind === "margin")) {
    row.cells.forEach((c, j) => {
      if (c.value !== null && Math.abs(c.value) > 1) warnings.push(`${row.label} for ${shown[j]!.label} exceeds 100%; check the filing.`);
    });
  }
  shown.forEach((y) => {
    if (y.weeks53) warnings.push(`${y.label} is a 53-week fiscal year; growth versus adjacent years is not like-for-like.`);
  });

  return { table: { years: shown, rows }, warnings };
}
