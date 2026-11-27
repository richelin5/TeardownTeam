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
  if (s.kind === "fred") return `FRED ${s.seriesId}, observation ${s.observationDate}`;
  const period = s.periodStart ? `${s.periodStart} to ${s.periodEnd}` : `at ${s.periodEnd}`;
  const valueUnit = unit === "shares" ? "shares" : "USD";
  return `${s.form} filed ${s.filed}, accn ${s.accn}, ${s.taxonomy}:${s.tag} = ${formatSourceValue(valueUnit, s.value)} (${period})`;
}

const SAFE_URL = /^https:\/\/(www\.sec\.gov|fred\.stlouisfed\.org)\//;
/** Only official SEC/FRED https URLs are ever rendered as links (secure-serverless rule 4). */
export function safeUrl(url: string | undefined): string | null {
  return url && SAFE_URL.test(url) ? url : null;
}

export function statusText(m: Metric): string {
  switch (m.status) {
    case "reported":
      return "Reported (single XBRL fact)";
    case "computed":
      return "Computed";
    case "n.m.":
      return "Not meaningful";
    case "not-reported":
      return "Not reported";
  }
}
