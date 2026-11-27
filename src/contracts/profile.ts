/**
 * Company Teardown v1 API contract: GET /api/teardown?ticker=XXX
 * Owner: software-architect (ADR 0001). Shared by netlify/functions, src/api, src/data and src/ui.
 * Every number is a Metric with provenance (source-citation skill). The UI never computes metrics.
 */

export const CONTRACT_VERSION = "1.0.0";

/** Exact missing-value wording required by the v1 scope. */
export const NOT_REPORTED = "not reported";

export type SecSource = {
  kind: "sec";
  taxonomy: "us-gaap" | "dei";
  tag: string;
  /** 0 = preferred tag in the fallback chain. */
  fallbackRank: number;
  accn: string;
  form: string;
  filed: string;
  /** Primary document URL (or filing index URL); always https://www.sec.gov/... */
  url: string;
  /** The fact's own period. */
  periodStart?: string;
  periodEnd: string;
  /** The fact's value in full units (lets a computed metric show each input). */
  value: number;
};

export type FredSource = {
  kind: "fred";
  seriesId: "DGS10" | "FEDFUNDS";
  observationDate: string;
  url: string; // https://fred.stlouisfed.org/series/{ID}
};

export type Source = SecSource | FredSource;

export type MetricStatus = "reported" | "computed" | "not-reported" | "n.m.";

export type MetricUnit =
  | "USD"
  | "shares"
  /** Ratio as a fraction: 0.234 = 23.4% (growth, margins). */
  | "ratio"
  /** Rate already in percent: 4.91 = 4.91% (FRED). */
  | "percent";

export type Metric = {
  id: string;
  label: string;
  /** Full units; null when status is "not-reported" or "n.m.". */
  value: number | null;
  unit: MetricUnit;
  status: MetricStatus;
  /** >= 1 unless status is "not-reported" (then it may hold partial inputs). */
  sources: Source[];
  /** Required when status is "computed" (names the input tags/rows). */
  formula?: string;
  notes?: string[];
};

export type FiscalYear = {
  /** Calendar year of the period end, e.g. 2026. */
  fy: number;
  /** e.g. "FY26 (Sep-26)". */
  label: string;
  start: string;
  end: string;
  /** Duration > 367 days. */
  weeks53: boolean;
};

export type RowKind = "value" | "growth" | "margin";

export type Row = {
  id:
    | "revenue"
    | "operating_income"
    | "net_income"
    | "da"
    | "ebitda"
    | "cash"
    | "total_debt"
    | "diluted_shares"
    | "revenue_growth"
    | "operating_income_growth"
    | "ebitda_growth"
    | "net_income_growth"
    | "operating_margin"
    | "ebitda_margin"
    | "net_margin";
  label: string;
  kind: RowKind;
  unit: MetricUnit;
  /** One Metric per fiscal year, aligned with FinancialTable.years (oldest first). */
  cells: Metric[];
};

export type FinancialTable = {
  /** Exactly 5 fiscal years, oldest first (fewer only if the company has fewer 10-K years). */
  years: FiscalYear[];
  rows: Row[];
};

export type FilingRef = {
  form: string;
  accn: string;
  filed: string;
  /** Period of report (YYYY-MM-DD). */
  reportDate: string;
  url: string;
};

export type Company = {
  name: string;
  ticker: string;
  /** 10-digit zero-padded. */
  cik: string;
  sic: string;
  sicDescription: string;
  /** MMDD as published by SEC submissions, e.g. "0925". */
  fiscalYearEnd: string;
  exchanges: string[];
  /** Other tickers sharing this CIK (multi-class warning). */
  otherTickers: string[];
};

export type Macro = {
  dgs10: Metric;
  fedfunds: Metric;
  attribution: string;
};

export type Profile = {
  contractVersion: string;
  generatedAt: string;
  dataMode: "live" | "fixtures";
  company: Company;
  filings: { latest10K: FilingRef | null; latest10Q: FilingRef | null };
  units: string;
  table: FinancialTable;
  macro: Macro;
  warnings: string[];
};

export type ErrorCode =
  | "bad_request"
  | "not_found"
  | "unsupported_filer"
  | "upstream_error"
  | "internal";

export type ErrorBody = { error: { code: ErrorCode; message: string } };

/** D&A row label whenever any D&A cell is computed (Depreciation + AmortizationOfIntangibleAssets). */
export const DA_COMPUTED_LABEL = "D&A (computed: depreciation + amortization of intangibles)";

/** Exact row labels (finance-reviewer ruling, docs/finance/definitions-v1.md). */
export const ROW_LABELS: Record<Row["id"], string> = {
  revenue: "Revenue",
  operating_income: "Operating income",
  net_income: "Net income",
  da: "D&A",
  ebitda: "EBITDA (computed: operating income + D&A)",
  cash: "Cash & cash equivalents",
  total_debt: "Total debt (incl. finance leases)",
  diluted_shares: "Diluted shares (weighted avg.)",
  revenue_growth: "Revenue growth",
  operating_income_growth: "Operating income growth",
  ebitda_growth: "EBITDA growth",
  net_income_growth: "Net income growth",
  operating_margin: "Operating margin",
  ebitda_margin: "EBITDA margin",
  net_margin: "Net margin",
};
