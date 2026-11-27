/**
 * Pure resolver: (companyfacts, submissions) → 5-FY financial table with provenance.
 * No network. Rules: xbrl-mapping skill + docs/finance/definitions-v1.md.
 */
import {
  DA_COMPUTED_LABEL,
  NOT_REPORTED,
  ROW_LABELS,
  type FinancialTable,
  type FiscalYear,
  type Metric,
  type MetricUnit,
  type Row,
  type SecSource,
} from "../contracts/profile";
import { classify, durationDays, isAnnualForm, toFiscalYear } from "./periods";
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
  /** fiscal period end (reportDate) → accn of the original 10-K for it, for "see filing" links */
  annualByReportDate: Map<string, string>;
};

export function makeContext(facts: CompanyFacts, submissions: Submissions, cik10: string): ResolveContext {
  const r = submissions.filings.recent;
  const primaryDocs = new Map<string, string>();
  const annualByReportDate = new Map<string, string>();
  r.accessionNumber.forEach((a, i) => {
    const doc = r.primaryDocument[i];
    if (doc) primaryDocs.set(a, doc);
    const rd = r.reportDate[i];
    // `recent` is newest first; keep the newest original 10-K per period end.
    if (r.form[i] === "10-K" && rd && !annualByReportDate.has(rd)) annualByReportDate.set(rd, a);
  });
  return { facts, cik10, primaryDocs, annualByReportDate };
}

const sourceUrl = (ctx: ResolveContext, accn: string): string => filingUrl(ctx.cik10, accn, ctx.primaryDocs.get(accn)) ?? "";

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
    url: sourceUrl(ctx, p.fact.accn),
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

const nm = (id: string, label: string, notes: string[], sources: Metric["sources"] = [], formula?: string): Metric => ({
  id,
  label,
  value: null,
  unit: "ratio",
  status: "n.m.",
  sources,
  ...(formula ? { formula } : {}),
  notes,
});

export const NOT_TAGGED = "Not tagged in standard XBRL; see filing";
/** Sentence-initial form of NOT_REPORTED, for notes on ratios with a missing input. */
const NOT_REPORTED_PREFIX = "Not reported";
const secOnly = (xs: Metric["sources"]): SecSource[] => xs.filter((x): x is SecSource => x.kind === "sec");

/** "Not tagged in standard XBRL; see filing: <10-K URL>" (the 10-K for that fiscal year end, when known). */
export function notTaggedNote(ctx: ResolveContext, year: FiscalYear): string {
  const accn = ctx.annualByReportDate.get(year.end);
  const url = accn ? sourceUrl(ctx, accn) : "";
  return url ? `${NOT_TAGGED}: ${url}` : `${NOT_TAGGED}.`;
}

function reportedMetric(ctx: ResolveContext, id: string, label: string, unit: MetricUnit, p: Picked): Metric {
  return { id, label, value: p.fact.val, unit, status: "reported", sources: [toSource(ctx, p)], ...(p.notes.length ? { notes: p.notes } : {}) };
}

function simpleMetric(ctx: ResolveContext, id: Row["id"], chain: readonly string[], unit: "USD" | "shares", year: FiscalYear, instant: boolean): Metric {
  const p = pickChain(ctx, chain, unit, year, instant);
  return p ? reportedMetric(ctx, id, ROW_LABELS[id], unit === "USD" ? "USD" : "shares", p) : notReported(id, ROW_LABELS[id], unit, notTaggedNote(ctx, year));
}

const fmtM = (v: number) => new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(v / 1e6);

// ---------------------------------------------------------------- D&A

/** Cash-flow D&A line names known to be company extensions (not in companyfacts), by CIK. */
const EXTENSION_CF_DA_LINE: Record<string, string> = {
  "0000789019": "Depreciation, amortization, and other", // msft:DepreciationAmortizationAndOther
};

/** Finance-reviewer finding 1 wording. "rounded to $0.1bn" only when both inputs are multiples of $100M. */
export function computedDaNote(cik10: string, rounded: boolean): string {
  const line = EXTENSION_CF_DA_LINE[cik10];
  return [
    `Computed: us-gaap Depreciation + AmortizationOfIntangibleAssets, both disclosed in the notes ${rounded ? "rounded to $0.1bn" : "(values may be rounded)"}.`,
    "The company does not tag a us-gaap D&A total.",
    `This figure does not tie to the cash-flow ${line ? `line '${line}'` : "statement's D&A line"} (company extension tag, not in standard XBRL) and can differ from it by several percent in either direction.`,
  ].join(" ");
}

function daMetric(ctx: ResolveContext, year: FiscalYear): Metric {
  const total = pickChain(ctx, CHAINS.da, "USD", year, false);
  if (total) return reportedMetric(ctx, "da", ROW_LABELS.da, "USD", total);
  const dep = pickChain(ctx, ["Depreciation"], "USD", year, false);
  const amort = pickChain(ctx, ["AmortizationOfIntangibleAssets"], "USD", year, false);
  if (dep && amort) {
    const ranked = (p: Picked): Picked => ({ ...p, rank: CHAINS.da.length });
    const rounded = dep.fact.val % 1e8 === 0 && amort.fact.val % 1e8 === 0;
    return {
      id: "da",
      label: DA_COMPUTED_LABEL,
      value: dep.fact.val + amort.fact.val,
      unit: "USD",
      status: "computed",
      sources: [toSource(ctx, ranked(dep)), toSource(ctx, ranked(amort))],
      formula: "Depreciation + AmortizationOfIntangibleAssets",
      notes: dedupe([computedDaNote(ctx.cik10, rounded), ...dep.notes, ...amort.notes]),
    };
  }
  return notReported("da", ROW_LABELS.da, "USD", notTaggedNote(ctx, year));
}

// ---------------------------------------------------------------- total debt

export const FL_ADDED_NOTE = "Includes finance lease liabilities reported outside the debt lines";
export const NO_FL_NOTE = "No finance lease liability tagged.";

type DebtResult = {
  metric: Metric;
  /** A chosen debt line is a *CapitalLeaseObligations tag (finance leases inside the debt lines). */
  cloChosen: boolean;
  /** LongTermDebt year where the company also tagged LongTermDebtAndCapitalLeaseObligations(+Current) for the same date. */
  comparative: { ltd: number; clo: number } | null;
  financeLeasesAdded: boolean;
  warnings: string[];
};

function totalDebtMetric(ctx: ResolveContext, year: FiscalYear): DebtResult {
  const label = ROW_LABELS.total_debt;
  const parts: Picked[] = [];
  const notes: string[] = [];
  const warnings: string[] = [];
  const direct = pickChain(ctx, CHAINS.debt_total_direct, "USD", year, true);
  if (direct) {
    parts.push(direct);
  } else {
    const nc = pickChain(ctx, CHAINS.debt_noncurrent, "USD", year, true);
    const cur = pickChain(ctx, CHAINS.debt_current, "USD", year, true);
    if (!nc || !cur) {
      return {
        metric: notReported("total_debt", label, "USD", `Long-term debt (non-current and current): ${notTaggedNote(ctx, year)}`),
        cloChosen: false,
        comparative: null,
        financeLeasesAdded: false,
        warnings,
      };
    }
    parts.push(nc, cur);
  }

  const st = pickChain(ctx, CHAINS.st_borrowings, "USD", year, true);
  if (st) {
    parts.push(st);
    // Finance-reviewer finding 4: first match assumes CP ⊂ the chosen line. Check it.
    if (st.tag !== "CommercialPaper") {
      const cp = pickChain(ctx, CHAINS.commercial_paper, "USD", year, true);
      if (cp && cp.fact.val > st.fact.val) {
        notes.push(
          `Check: commercial paper ($${fmtM(cp.fact.val)}M, us-gaap:CommercialPaper, ${cp.fact.accn}) exceeds the short-term borrowings line used ($${fmtM(st.fact.val)}M, us-gaap:${st.tag}), so it is not a subset of that line and total debt may be understated; see filing.`,
        );
        warnings.push(
          `Total debt ${year.label}: commercial paper exceeds us-gaap:${st.tag}, so the assumption that it is included there does not hold. Total debt may be understated; check the filing.`,
        );
      }
    }
  } else {
    notes.push("No short-term borrowings (notes payable, short-term borrowings or commercial paper) tagged at this date.");
  }

  // Finance leases (finance-reviewer finding 2): include them for every company, exactly once.
  const cloChosen = parts.some((p) => p.tag.includes("CapitalLeaseObligations"));
  let includesFl = cloChosen;
  let comparative: DebtResult["comparative"] = null;
  if (!includesFl && direct) {
    const [ncTag, curTag] = CHAINS.debt_incl_finance_leases;
    const nc = pickChain(ctx, [ncTag], "USD", year, true);
    const cur = pickChain(ctx, [curTag], "USD", year, true);
    if (nc && cur) {
      comparative = { ltd: direct.fact.val, clo: nc.fact.val + cur.fact.val };
      // Same date, same total under both tags: LongTermDebt already includes the finance leases.
      if (comparative.clo === comparative.ltd) includesFl = true;
    }
  }
  const fl: Picked[] = [];
  if (!includesFl) {
    const total = pickChain(ctx, CHAINS.finance_lease_total, "USD", year, true);
    if (total) {
      fl.push(total);
    } else {
      for (const tag of CHAINS.finance_lease_parts) {
        const p = pickChain(ctx, [tag], "USD", year, true);
        if (p) fl.push({ ...p, rank: 1 });
      }
    }
    if (fl.length) {
      notes.push(`${FL_ADDED_NOTE} (${fl.map((p) => `us-gaap:${p.tag}`).join(" + ")}).`);
      if (fl.length === 1 && fl[0]!.tag !== "FinanceLeaseLiability") {
        notes.push(`Only us-gaap:${fl[0]!.tag} is tagged; the other portion of finance lease liabilities is not tagged in standard XBRL.`);
      }
    } else {
      notes.push(NO_FL_NOTE);
    }
  }

  const all = [...parts, ...fl];
  for (const p of all) notes.push(...p.notes);
  notes.push("Excludes operating lease liabilities.");
  const value = all.reduce((s, p) => s + p.fact.val, 0);
  const sources = all.map((p) => toSource(ctx, p));
  const metric: Metric =
    all.length === 1
      ? { id: "total_debt", label, value, unit: "USD", status: "reported", sources, notes: dedupe(notes) }
      : { id: "total_debt", label, value, unit: "USD", status: "computed", sources, formula: all.map((p) => p.tag).join(" + "), notes: dedupe(notes) };
  return { metric, cloChosen, comparative, financeLeasesAdded: fl.length > 0, warnings };
}

const shortFy = (y: FiscalYear) => y.label.split(" ")[0]!;

/**
 * Company-level note when the debt lines themselves carry finance leases (KO): finance-reviewer finding 3.
 * Returns null when no year uses a *CapitalLeaseObligations debt tag.
 */
function debtLinesIncludeLeasesNote(years: FiscalYear[], debt: DebtResult[], warnings: string[]): string | null {
  const cloIdx = debt.map((d, i) => (d.cloChosen ? i : -1)).filter((i) => i >= 0);
  if (!cloIdx.length) return null;
  const first = Math.min(...cloIdx);
  const bits = [`tagged LongTermDebtAndCapitalLeaseObligations${first > 0 ? ` from ${shortFy(years[first]!)}` : ""}`];
  debt.forEach((d, i) => {
    if (!d.comparative) return;
    if (d.comparative.clo === d.comparative.ltd) {
      bits.push(`the ${shortFy(years[i]!)} comparative is identical under both tags`);
    } else {
      bits.push(
        `the ${shortFy(years[i]!)} comparative differs under the two tags: LongTermDebt $${fmtM(d.comparative.ltd)}M vs $${fmtM(d.comparative.clo)}M; see filing`,
      );
      warnings.push(`Total debt ${years[i]!.label}: LongTermDebt and LongTermDebtAndCapitalLeaseObligations differ for the same date; check the filing.`);
    }
  });
  return `The company's debt lines include finance lease obligations (${bits.join("; ")}).`;
}

// ---------------------------------------------------------------- cash

const INVESTMENT_LABEL: Record<string, string> = {
  ShortTermInvestments: "short-term investments",
  MarketableSecuritiesCurrent: "current marketable securities",
  AvailableForSaleSecuritiesDebtSecuritiesCurrent: "current available-for-sale debt securities",
  OtherShortTermInvestments: "short-term investments",
};

function cashMetric(ctx: ResolveContext, year: FiscalYear): Metric {
  const m = simpleMetric(ctx, "cash", CHAINS.cash, "USD", year, true);
  if (m.value === null) return m;
  const inv = pickChain(ctx, CHAINS.st_investments, "USD", year, true);
  const note = inv
    ? `Excludes ${INVESTMENT_LABEL[inv.tag] ?? "short-term investments"} of $${fmtM(inv.fact.val)}M (us-gaap:${inv.tag}, ${inv.fact.accn}) and any other investment lines on the balance sheet; see filing.`
    : "No short-term investments or current marketable securities tagged at this date; any shown on the balance sheet are excluded.";
  return { ...m, notes: [...(m.notes ?? []), note] };
}

// ---------------------------------------------------------------- EBITDA, growth, margins

const FIN_NM = "n.m.: EBITDA is not meaningful for financial institutions.";

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

/** Consecutive fiscal years: period ends 350–380 days apart (finance-reviewer finding 8). */
export const consecutive = (prior: FiscalYear, cur: FiscalYear) => {
  const d = durationDays(prior.end, cur.end);
  return d >= 350 && d <= 380;
};

const weeks53Notes = (...ys: FiscalYear[]) => ys.filter((y) => y.weeks53).map((y) => `Not like-for-like: ${y.label} is a 53-week year`);

type GrowthInput = {
  id: Row["id"];
  /** Lower-case noun for notes, e.g. "revenue". */
  noun: string;
  /** Formula noun, e.g. "Revenue". */
  base: string;
  cur: Metric;
  prior: Metric | undefined;
  curYear: FiscalYear;
  priorYear: FiscalYear | undefined;
  extraNotes?: string[];
};

function growthMetric(g: GrowthInput): Metric {
  const { id, noun, base, cur, prior, curYear, priorYear } = g;
  const label = ROW_LABELS[id];
  if (!prior || !priorYear) {
    return notReported(id, label, "ratio", `${NOT_REPORTED_PREFIX}: needs prior-year ${noun} (no earlier fiscal year in the 10-K data).`);
  }
  const sources = [...cur.sources, ...prior.sources];
  const formula = `${base} ${curYear.label} / ${base} ${priorYear.label} − 1`;
  if (!consecutive(priorYear, curYear)) {
    return nm(id, label, [`n.m.: non-consecutive fiscal years (${priorYear.label} to ${curYear.label}).`], sources, formula);
  }
  if (cur.value === null || prior.value === null) {
    const missing = [cur.value === null ? curYear : null, prior.value === null ? priorYear : null].filter((y): y is FiscalYear => y !== null);
    const what = `${missing.map((y) => y.label).join(" and ")} ${noun}`;
    // An input that is itself n.m. keeps n.m.; a missing (not-reported) input makes the ratio "not reported".
    if ([cur, prior].some((m) => m.status === "n.m.")) return nm(id, label, [`n.m.: needs ${what}, which is n.m.`], sources);
    return notReported(id, label, "ratio", `${NOT_REPORTED_PREFIX}: needs ${what}, which ${missing.length > 1 ? "are" : "is"} ${NOT_REPORTED}.`, secOnly(sources));
  }
  if (prior.value <= 0) return nm(id, label, ["n.m.: prior-year value is zero or negative."], sources, formula);
  const notes = dedupe([...weeks53Notes(priorYear, curYear), ...(g.extraNotes ?? [])]);
  return { id, label, value: cur.value / prior.value - 1, unit: "ratio", status: "computed", sources, formula, ...(notes.length ? { notes } : {}) };
}

function marginMetric(id: Row["id"], noun: string, base: string, num: Metric, rev: Metric, year: FiscalYear): Metric {
  const label = ROW_LABELS[id];
  const sources = [...num.sources, ...rev.sources];
  if (num.value === null || rev.value === null) {
    const both = num.value === null && rev.value === null;
    const what = `${year.label} ${both ? `${noun} and revenue` : num.value === null ? noun : "revenue"}`;
    if ([num, rev].some((m) => m.status === "n.m.")) return nm(id, label, [`n.m.: needs ${what}, which is n.m.`], sources);
    return notReported(id, label, "ratio", `${NOT_REPORTED_PREFIX}: needs ${what}, which ${both ? "are" : "is"} ${NOT_REPORTED}.`, secOnly(sources));
  }
  const formula = `${base} / Revenue (${year.label})`;
  if (rev.value <= 0) return nm(id, label, ["n.m.: revenue is zero or negative."], sources, formula);
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

export const isFinancialSic = (sic: string) => /^(602\d|63\d\d)$/.test(sic);

export function resolveTable(ctx: ResolveContext, sic: string): ResolveResult {
  const warnings: string[] = [];
  // One extra (older) year so the oldest shown year has a growth rate.
  const allYears = discoverFiscalYears(ctx, YEARS_SHOWN + 1).reverse(); // oldest first
  const shown = allYears.slice(-YEARS_SHOWN);
  const offset = allYears.length - shown.length;
  if (shown.length < YEARS_SHOWN) warnings.push(`Only ${shown.length} fiscal year(s) of 10-K data are available.`);

  const debt = allYears.map((y) => totalDebtMetric(ctx, y));
  const leaseNote = debtLinesIncludeLeasesNote(allYears, debt, warnings);
  const per = allYears.map((y, i) => {
    const revenue = simpleMetric(ctx, "revenue", CHAINS.revenue, "USD", y, false);
    const operating_income = simpleMetric(ctx, "operating_income", CHAINS.operating_income, "USD", y, false);
    const net_income = simpleMetric(ctx, "net_income", CHAINS.net_income, "USD", y, false);
    const da = daMetric(ctx, y);
    const ebitda = ebitdaMetric(operating_income, da);
    let total_debt = debt[i]!.metric;
    // The company-level note explains where the leases are, so "none tagged separately" would only confuse.
    if (leaseNote && !debt[i]!.financeLeasesAdded) {
      total_debt = { ...total_debt, notes: dedupe([leaseNote, ...(total_debt.notes ?? []).filter((n) => n !== NO_FL_NOTE)]) };
    }
    return {
      revenue,
      operating_income,
      net_income,
      da,
      ebitda,
      cash: cashMetric(ctx, y),
      total_debt,
      diluted_shares: simpleMetric(ctx, "diluted_shares", CHAINS.diluted_shares, "shares", y, false),
    };
  });
  debt.slice(offset).forEach((d) => warnings.push(...d.warnings));

  const isFinancial = isFinancialSic(sic);
  if (isFinancial) {
    for (const p of per) {
      const { formula: _unused, ...rest } = p.ebitda;
      p.ebitda = { ...rest, value: null, status: "n.m.", notes: [FIN_NM] };
    }
  }

  // Sanity checks (fail closed for revenue <= 0 in non-financials). The value is withheld ("not reported"), but
  // ratios on it stay n.m. ("revenue is zero or negative"): the data exists, the ratio is meaningless.
  const revenueNonPositive = new Set<number>();
  per.forEach((p, i) => {
    if (!isFinancial && p.revenue.value !== null && p.revenue.value <= 0) {
      revenueNonPositive.add(i);
      warnings.push(`Revenue for ${allYears[i]!.label} is zero or negative; it is shown as not reported.`);
      p.revenue = notReported("revenue", ROW_LABELS.revenue, "USD", "Failed sanity check (revenue ≤ 0).");
    }
  });

  // D&A method across years (finance-reviewer finding 1): label, page warnings, EBITDA growth notes.
  const shownDa = per.slice(offset).map((p) => p.da);
  const computedYears = shown.filter((_, j) => shownDa[j]!.status === "computed");
  const reportedYears = shown.filter((_, j) => shownDa[j]!.status === "reported");
  if (computedYears.length) {
    warnings.push(
      `D&A is computed for ${computedYears.map((y) => y.label).join(", ")} as us-gaap Depreciation + AmortizationOfIntangibleAssets because the company does not tag a us-gaap D&A total. It does not tie to the cash-flow statement's D&A line and can differ from it by several percent in either direction; EBITDA, EBITDA growth and EBITDA margin inherit the difference.`,
    );
  }
  if (computedYears.length && reportedYears.length) {
    warnings.push(
      `The D&A row mixes methods across years: reported (us-gaap D&A total) for ${reportedYears.map((y) => y.label).join(", ")}; computed (Depreciation + AmortizationOfIntangibleAssets) for ${computedYears.map((y) => y.label).join(", ")}. D&A and EBITDA are not like-for-like across the change.`,
    );
  }
  const daMethodNote = (i: number): string[] => {
    const a = per[i - 1]?.da.status;
    const b = per[i]!.da.status;
    if (i === 0 || a === b || (a !== "reported" && a !== "computed") || (b !== "reported" && b !== "computed")) return [];
    return [`Not like-for-like: D&A is ${a} in ${allYears[i - 1]!.label} and ${b} in ${allYears[i]!.label}`];
  };

  const valueRow = (id: keyof (typeof per)[number], unit: MetricUnit): Row => ({
    id,
    label: ROW_LABELS[id],
    kind: "value",
    unit,
    cells: per.slice(offset).map((p) => p[id]),
  });
  const NOUN = { revenue: ["revenue", "Revenue"], operating_income: ["operating income", "Operating income"], ebitda: ["EBITDA", "EBITDA"], net_income: ["net income", "Net income"] } as const;
  const growthRow = (id: Row["id"], key: keyof typeof NOUN): Row => ({
    id,
    label: ROW_LABELS[id],
    kind: "growth",
    unit: "ratio",
    cells: shown.map((y, j) => {
      const i = j + offset;
      if (isFinancial && key === "ebitda") return nm(id, ROW_LABELS[id], [FIN_NM]);
      if (key === "revenue" && i > 0 && (revenueNonPositive.has(i) || revenueNonPositive.has(i - 1))) {
        const bad = revenueNonPositive.has(i) ? y : allYears[i - 1]!;
        return nm(id, ROW_LABELS[id], [`n.m.: revenue is zero or negative in ${bad.label}.`]);
      }
      return growthMetric({
        id,
        noun: NOUN[key][0],
        base: NOUN[key][1],
        cur: per[i]![key],
        prior: i > 0 ? per[i - 1]![key] : undefined,
        curYear: y,
        priorYear: i > 0 ? allYears[i - 1] : undefined,
        ...(key === "ebitda" ? { extraNotes: daMethodNote(i) } : {}),
      });
    }),
  });
  const marginRow = (id: Row["id"], key: "operating_income" | "ebitda" | "net_income"): Row => ({
    id,
    label: ROW_LABELS[id],
    kind: "margin",
    unit: "ratio",
    cells: shown.map((y, j) =>
      isFinancial && key === "ebitda"
        ? nm(id, ROW_LABELS[id], [FIN_NM])
        : revenueNonPositive.has(j + offset)
          ? nm(id, ROW_LABELS[id], ["n.m.: revenue is zero or negative."])
          : marginMetric(id, NOUN[key][0], NOUN[key][1], per[j + offset]![key], per[j + offset]!.revenue, y),
    ),
  });

  const daRow = valueRow("da", "USD");
  if (computedYears.length) daRow.label = DA_COMPUTED_LABEL;

  const rows: Row[] = [
    valueRow("revenue", "USD"),
    growthRow("revenue_growth", "revenue"),
    valueRow("operating_income", "USD"),
    growthRow("operating_income_growth", "operating_income"),
    marginRow("operating_margin", "operating_income"),
    daRow,
    valueRow("ebitda", "USD"),
    growthRow("ebitda_growth", "ebitda"),
    marginRow("ebitda_margin", "ebitda"),
    valueRow("net_income", "USD"),
    growthRow("net_income_growth", "net_income"),
    marginRow("net_margin", "net_income"),
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
