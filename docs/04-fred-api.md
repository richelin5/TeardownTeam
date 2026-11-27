# FRED API (Federal Reserve Economic Data)

Used for market context on the one-pager: risk-free rate, policy rate, and optionally credit spreads and macro data. These feed a "Rates & Macro" strip and a rough WACC input.

Verified against FRED docs on 2026-11-27.

## Access

- **Free API key required.** Create a FRED account at https://fredaccount.stlouisfed.org, then request a key at https://fredaccount.stlouisfed.org/apikeys. The key is a 32-character lowercase alphanumeric string.
- FRED's terms: "Developers should request a distinct API key for each application they build." Get one key for Company Teardown.
- **Keep the key server-side** in a Netlify env var, `FRED_API_KEY`. Don't put it in front-end code. (FRED does send CORS headers on some endpoints, but exposing the key would let anyone use up our quota.)
- **Rate limit:** "Up to 120 requests per minute are allowed before being served a 429 error code. Not complying with the throttling can result in a temporary block."
- Base URL: `https://api.stlouisfed.org/fred/`
- Default response format is **XML**, so always pass `file_type=json`.

## Core endpoint

```
GET https://api.stlouisfed.org/fred/series/observations
    ?series_id=DGS10
    &api_key=$FRED_API_KEY
    &file_type=json
    &sort_order=desc
    &limit=10
```

Response (trimmed; the second observation shows how a holiday looks):
```json
{
  "units": "lin", "count": 10, "sort_order": "desc",
  "observations": [
    {"realtime_start": "2026-11-27", "realtime_end": "2026-11-27", "date": "2026-11-24", "value": "4.91"},
    {"realtime_start": "…",          "realtime_end": "…",          "date": "<a bond-market holiday>", "value": "."}
  ]
}
```

Gotchas:
- **`value` is a string**, and missing days (market holidays) are `"."`. Use `limit=10` with `sort_order=desc`, then take the first observation whose value isn't `"."`.
- `date` is the **observation date**, not the publish date. Show "as of 2026-11-24".
- Useful parameters: `observation_start` / `observation_end` (YYYY-MM-DD), `frequency` (`d`,`w`,`m`,`q`,`a`) with `aggregation_method` (`avg`,`sum`,`eop`) to down-sample, and `units` (`lin`, `chg`, `ch1`, `pch`, `pc1` = YoY %, …).
- `realtime_start`/`realtime_end`/`vintage_dates` (ALFRED) give historical vintages. We don't need them.
- Series metadata (title, units, frequency, last updated) comes from `GET /fred/series?series_id=DGS10`. Use it once to build the source footnote text.

## Series for the one-pager

| Purpose | Series ID | Description | Freq | Units |
|---|---|---|---|---|
| Risk-free rate (WACC) | **DGS10** | Market Yield on U.S. Treasury Securities at 10-Year Constant Maturity | Daily | % |
| Policy rate | **FEDFUNDS** | Federal Funds Effective Rate (monthly average of daily figures) | Monthly | % |
| Policy rate, daily | DFF | Federal Funds Effective Rate | Daily | % |
| Fed target range | DFEDTARU / DFEDTARL | Upper / lower limit of the target range | Daily | % |
| Short rate | DGS3MO / DTB3 | 3-month Treasury | Daily | % |
| 2-year | DGS2 | 2-year Treasury | Daily | % |
| Curve slope | T10Y2Y | 10Y minus 2Y spread | Daily | pp |
| IG credit spread | BAMLC0A0CM | ICE BofA US Corporate Index OAS | Daily | % |
| HY credit spread | BAMLH0A0HYM2 | ICE BofA US High Yield Index OAS | Daily | % |
| Baa yield | DBAA | Moody's Seasoned Baa Corporate Bond Yield | Daily | % |
| Inflation | CPIAUCSL (units=`pc1`) | CPI-U, YoY % | Monthly | % |
| Growth | GDPC1 (units=`pc1`) | Real GDP, YoY % | Quarterly | % |
| Equity context | SP500 | S&P 500 index level | Daily | index |

Facts checked on FRED today:
- DGS10: source Board of Governors (H.15 Selected Interest Rates), daily, NSA. The latest observation was **2026-11-24: 4.91%**.
- FEDFUNDS: H.15, monthly, "Averages of daily figures". The latest was **Oct 2026: 3.88%**. For a "current" figure, prefer **DFF** (daily) or the target range, because FEDFUNDS lags by a month.

ICE BofA series on FRED have licensing restrictions (FRED shows recent history only). That's fine for showing the current spread.

## Using it on the page

- **Rates strip:** 10Y UST, Fed funds (target range), IG/HY OAS, each with an "as of" date and a link to `https://fred.stlouisfed.org/series/{ID}`.
- **Illustrative WACC input:** cost of equity = DGS10 + β × ERP. β and ERP aren't available from free official APIs, so make them user inputs with defaults, labeled as assumptions. Pre-tax cost of debt can be approximated as interest expense / average debt from XBRL, cross-checked against DBAA.

## Caching

Rates change at most daily (H.15 publishes around 4:15 p.m. ET on business days). Cache FRED responses for **1–6 hours** (Netlify CDN `s-maxage` or Blobs). Fetch all series in parallel. Five or so series per page view is far below 120/min once cached.

## Attribution

Cite each value as "Source: FRED, Federal Reserve Bank of St. Louis; {series title} ({ID}), retrieved {date}". FRED tags many series "public domain: citation requested". Follow the FRED API Terms of Use: https://fred.stlouisfed.org/legal/#api (no implying endorsement; respect third-party series copyrights).

## Sources
- series/observations: https://fred.stlouisfed.org/docs/api/fred/series_observations.html
- API keys: https://fred.stlouisfed.org/docs/api/api_key.html
- Errors and rate limit: https://fred.stlouisfed.org/docs/api/fred/errors.html
- DGS10: https://fred.stlouisfed.org/series/DGS10
- FEDFUNDS: https://fred.stlouisfed.org/series/FEDFUNDS
