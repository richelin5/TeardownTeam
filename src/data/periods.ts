/** Period logic (xbrl-mapping skill): classify by duration, never by fy/fp. */
import type { FiscalYear } from "../contracts/profile";

export type PeriodClass = "FY" | "Q" | "YTD6" | "YTD9" | "instant" | "irregular";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function durationDays(start: string, end: string): number {
  return Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86_400_000);
}

export function classify(start: string | undefined, end: string): PeriodClass {
  if (!start) return "instant";
  const d = durationDays(start, end);
  if (d >= 80 && d <= 100) return "Q";
  if (d >= 170 && d <= 200) return "YTD6";
  if (d >= 260 && d <= 290) return "YTD9";
  if (d >= 350 && d <= 380) return "FY";
  return "irregular";
}

/** "FY26 (Sep-26)" from the period end. */
export function fiscalLabel(end: string): string {
  const y = end.slice(2, 4);
  const m = MONTHS[Number(end.slice(5, 7)) - 1] ?? "???";
  return `FY${y} (${m}-${y})`;
}

export function toFiscalYear(start: string, end: string): FiscalYear {
  return {
    fy: Number(end.slice(0, 4)),
    label: fiscalLabel(end),
    start,
    end,
    weeks53: durationDays(start, end) > 367,
  };
}

export const isAnnualForm = (form: string) => form === "10-K" || form === "10-K/A";
