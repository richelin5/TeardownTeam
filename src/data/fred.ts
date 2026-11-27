/** FRED client (fred-api skill). The API key is server-side only and never appears in errors or logs. */
import type { Metric } from "../contracts/profile";
import { NOT_REPORTED } from "../contracts/profile";
import { UpstreamError } from "./errors";
import { fetchWithRetry, HOUR, TtlCache, type FetchLike, type Sleep } from "./http";

export const FRED_SERIES = ["DGS10", "FEDFUNDS"] as const;
export type FredSeriesId = (typeof FRED_SERIES)[number];
export const FRED_TTL = 1 * HOUR;
export const FRED_ATTRIBUTION = "Source: FRED, Federal Reserve Bank of St. Louis";

const META: Record<FredSeriesId, { id: string; label: string; notes: string[] }> = {
  DGS10: {
    id: "dgs10",
    label: "10-Year Treasury yield",
    notes: ["Market yield on U.S. Treasury securities at 10-year constant maturity (daily)."],
  },
  FEDFUNDS: {
    id: "fedfunds",
    label: "Fed funds rate (effective, monthly avg.)",
    notes: ["Monthly average of the effective federal funds rate; the observation date is the first day of that month."],
  },
};

export const fredObservationsUrl = (id: FredSeriesId, apiKey: string) =>
  `https://api.stlouisfed.org/fred/series/observations?series_id=${id}&api_key=${encodeURIComponent(apiKey)}&file_type=json&sort_order=desc&limit=10`;

type Observations = { observations?: { date: string; value: string }[] };

export type FredDeps = { fetch: FetchLike; apiKey: string; cache?: TtlCache; sleep?: Sleep };

/** Latest non-missing observation. Missing days are "." in FRED. */
export function latestObservation(body: Observations): { date: string; value: number } | null {
  for (const o of body.observations ?? []) {
    if (o.value === "." || o.value.trim() === "") continue;
    const n = Number(o.value);
    if (Number.isFinite(n) && /^\d{4}-\d{2}-\d{2}$/.test(o.date)) return { date: o.date, value: n };
  }
  return null;
}

export function notReportedRate(id: FredSeriesId, reason: string): Metric {
  return { id: META[id].id, label: META[id].label, value: null, unit: "percent", status: "not-reported", sources: [], notes: [reason, NOT_REPORTED] };
}

export async function fetchRate(id: FredSeriesId, deps: FredDeps): Promise<Metric> {
  const cache = deps.cache ?? new TtlCache();
  const cacheKey = `fred:${id}`;
  let body = cache.get<Observations>(cacheKey);
  if (!body) {
    const res = await fetchWithRetry(
      deps.fetch,
      fredObservationsUrl(id, deps.apiKey),
      { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(10_000) },
      { sleep: deps.sleep },
    );
    // Never include the URL (it contains the key) in the error.
    if (!res.ok) throw new UpstreamError("fred", res.status);
    try {
      body = (await res.json()) as Observations;
    } catch {
      throw new UpstreamError("fred", res.status, "Malformed response from FRED");
    }
    cache.set(cacheKey, body, FRED_TTL);
  }
  const obs = latestObservation(body);
  if (!obs) return notReportedRate(id, "No recent observation available from FRED.");
  return {
    id: META[id].id,
    label: META[id].label,
    value: obs.value,
    unit: "percent",
    status: "reported",
    sources: [{ kind: "fred", seriesId: id, observationDate: obs.date, url: `https://fred.stlouisfed.org/series/${id}` }],
    notes: META[id].notes,
  };
}

/** One series failing degrades only that series (fred-api rule 8). */
export async function fetchMacro(deps: FredDeps, log: (msg: string) => void = () => {}) {
  const [dgs10, fedfunds] = await Promise.all(
    FRED_SERIES.map((id) =>
      fetchRate(id, deps).catch((err: unknown) => {
        log(`fred ${id} failed: ${err instanceof UpstreamError ? `status ${err.status}` : err instanceof Error ? err.name : "unknown"}`);
        return notReportedRate(id, "FRED did not respond; try again later.");
      }),
    ),
  );
  return { dgs10: dgs10!, fedfunds: fedfunds!, attribution: FRED_ATTRIBUTION };
}
