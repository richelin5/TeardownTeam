---
name: fred-api
description: Rules for using the FRED API in Company Teardown (secret API key, 120 req/min, series/observations, which series to show such as DGS10, DFF, FEDFUNDS and OAS spreads, missing "." values, caching, attribution). Use when writing, reviewing or testing rates and macro data.
---

# FRED integration rules

Full research: `docs/04-fred-api.md`.

1. The key lives in `process.env.FRED_API_KEY` (server-side only). It must never appear in client bundles, logs or error messages.
2. Rate limit: **120 requests/minute**, else 429 and a possible temporary block. Cache 1–6 h.
3. Call: `GET https://api.stlouisfed.org/fred/series/observations?series_id={ID}&api_key=…&file_type=json&sort_order=desc&limit=10`. Always pass `file_type=json` (the default is XML).
4. `value` is a **string**, and missing days are `"."`. Take the first observation that isn't `"."`, and show its `date` as "as of".
5. v1 series: `DGS10` (10Y UST, daily), `DFF` (effective fed funds, daily), `DFEDTARU`/`DFEDTARL` (target range), `FEDFUNDS` (monthly average; it lags, so label it), `BAMLC0A0CM` (IG OAS), `BAMLH0A0HYM2` (HY OAS).
6. Every FRED value is a `Metric` with a `FredSource` (`seriesId`, `observationDate`, `url: https://fred.stlouisfed.org/series/{ID}`).
7. Attribution on the page: "Source: FRED, Federal Reserve Bank of St. Louis".
8. Fetch series in parallel. If one series fails, degrade to "unavailable" for it alone, never the whole page.
