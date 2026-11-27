/** Display formatting only (banker-metric-definitions display rules). The UI never computes metrics. */
import { NOT_REPORTED, type Metric, type Source } from "../contracts/profile";

const int = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

function parens(neg: boolean, s: string): string {
  return neg ? `(${s})` : s;
}

export function formatValue(m: Metric): string {
  if (m.status === "not-reported" || (m.value === null && m.status !== "n.m.")) return NOT_REPORTED;
  if (m.status === "n.m." || m.value === null) return "n.m.";
  const v = m.value;
  switch (m.unit) {
    case "USD":
    case "shares":
      return parens(v < 0, int.format(Math.abs(v) / 1e6));
    case "ratio":
      return parens(v < 0, `${(Math.abs(v) * 100).toFixed(1)}%`);
    case "percent":
      return `${v.toFixed(2)}%`;
  }
}

/** Unit-explicit value for tooltips and the sources panel, e.g. "$478,834M". */
export function formatLong(m: Metric): string {
  const base = formatValue(m);
  if (m.value === null) return base;
  if (m.unit === "USD") return m.value < 0 ? `($${base.slice(1, -1)}M)` : `$${base}M`;
  if (m.unit === "shares") return `${base}M shares`;
  return base;
}

export function formatSourceValue(unit: Metric["unit"], v: number): string {
  if (unit === "shares") return `${int.format(v / 1e6)}M shares`;
  const s = int.format(Math.abs(v) / 1e6);
  return v < 0 ? `($${s}M)` : `$${s}M`;
}

export function describeSource(s: Source, unit: Metric["unit"]): string {
  if (s.kind === "fred") {
    return s.seriesId === "FEDFUNDS"
      ? `FRED ${s.seriesId}, ${monthYear(s.observationDate)} monthly average`
      : `FRED ${s.seriesId}, observation ${s.observationDate}`;
  }
  const period = s.periodStart ? `${s.periodStart} to ${s.periodEnd}` : `at ${s.periodEnd}`;
  const valueUnit = unit === "shares" ? "shares" : "USD";
  return `${s.form} filed ${s.filed}, accn ${s.accn}, ${s.taxonomy}:${s.tag} = ${formatSourceValue(valueUnit, s.value)} (${period})`;
}

const SAFE_URL = /^https:\/\/(www\.sec\.gov|fred\.stlouisfed\.org)\//;
/** Only official SEC/FRED https URLs are ever rendered as links (secure-serverless rule 4). */
export function safeUrl(url: string | undefined): string | null {
  return url && SAFE_URL.test(url) ? url : null;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-10-01" -> "Oct-2026". Falls back to the input when it isn't an ISO date. */
export function monthYear(iso: string): string {
  const m = /^(\d{4})-(\d{2})/.exec(iso);
  const name = m ? MONTHS[Number(m[2]) - 1] : undefined;
  return m && name ? `${name}-${m[1]}` : iso;
}

/** Date caption next to a macro rate: monthly series show the month, daily series keep the date. */
export function macroDateText(s: Source | undefined): string {
  if (!s || s.kind !== "fred") return "";
  return s.seriesId === "FEDFUNDS" ? `${monthYear(s.observationDate)} average` : `as of ${s.observationDate}`;
}

/** "Dec 31" for a fixed 1231 year end; otherwise "Sep (latest FY ended 2026-09-26)" (52/53-week years float). */
export function fiscalYearEndText(mmdd: string, latestEnd?: string): string {
  const mi = Number(mmdd.slice(0, 2)) - 1;
  const month = MONTHS[mi];
  if (!month || !/^\d{4}$/.test(mmdd)) return mmdd;
  if (mmdd === "1231") return "Dec 31";
  return latestEnd ? `${month} (latest FY ended ${latestEnd})` : month;
}

export function statusText(m: Metric): string {
  if (m.sources.length > 0 && m.sources.every((s) => s.kind === "fred")) return "FRED observation";
  switch (m.status) {
    case "reported":
      return "Reported (single XBRL fact)";
    case "computed":
      return "Computed";
    case "n.m.":
      return "Not meaningful";
    case "not-reported":
      return "not reported";
  }
}
