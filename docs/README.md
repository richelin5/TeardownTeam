# Company Teardown: Research Docs

Company Teardown: type a US public company's ticker and get a one-page, banker-style profile built only from free public data (SEC EDGAR + FRED), **with a source on every number**.

These docs hold the research behind the build. Facts about external APIs were checked against official pages on **2026-11-27**, and each doc lists its sources.

| # | Doc | What's in it |
|---|---|---|
| 1 | [SEC EDGAR APIs](01-sec-edgar-apis.md) | Ticker→CIK files, submissions, companyfacts, companyconcept, frames; User-Agent, 10 req/s fair access, no CORS; building filing URLs from accession numbers |
| 2 | [XBRL tags](02-xbrl-tags.md) | Fallback tag chains for revenue, operating income, net income, D&A, cash, debt, diluted shares, cash flow, cover-page `dei` tags |
| 3 | [XBRL pitfalls](03-xbrl-pitfalls.md) | Duplicates across filings, `fy`/`fp` traps, quarterly vs YTD vs annual, deriving Q4 and LTM, non-December and 52/53-week fiscal years, restatements, multi-class shares, sector exceptions |
| 4 | [FRED API](04-fred-api.md) | Free API key, 120 req/min, `series/observations`, DGS10, FEDFUNDS/DFF and other rate and spread series, caching and attribution |
| 5 | [IB one-pager expectations](05-ib-one-pager.md) | Layout, sections, EV bridge, multiples, credit stats, footnoting, formatting conventions, the checks an associate runs |
| 6 | [Netlify deployment](06-netlify-deployment.md) | Functions layout and code, CDN caching (`Netlify-CDN-Cache-Control`, `durable`, SWR, `Netlify-Vary`), Blobs, env vars, guardrails |

## Architecture in one picture

```
Browser (static page)
   │  GET /api/teardown?ticker=AAPL
   ▼
Netlify CDN ── cache hit? ──► return cached JSON        (s-maxage 1h + SWR 24h, durable)
   │ miss
   ▼
Netlify Function  (User-Agent + FRED key live here; data.sec.gov has no CORS)
   ├─ Blobs cache: company_tickers.json (24h) → CIK
   ├─ data.sec.gov/submissions/CIK…json             (name, SIC, FYE, filings → source URLs)
   ├─ data.sec.gov/api/xbrl/companyfacts/CIK…json   (all us-gaap/dei facts)
   ├─ api.stlouisfed.org/fred/series/observations    (DGS10, DFF, OAS…)
   └─ resolver: tag fallback chains → dedupe → classify periods → FY / LTM / latest BS
        → every metric = { value, tag, period, form, filed, accn, url, derivedFormula? }
```

## Key decisions the research supports
1. **All upstream calls run server-side** (SEC: no CORS and a required UA; FRED: secret key).
2. **One companyfacts call per ticker**, resolved locally, instead of many companyconcept calls.
3. **Resolve tags per period with fallback chains.** Never assume one tag per company.
4. **Classify periods by duration**, never by `fp`/`fy`. Derive Q4 and LTM explicitly and label them.
5. **Latest-filed wins** for restated periods. Prefer the latest 10-K's own comparative columns.
6. **Share price is the one gap.** SEC and FRED don't provide it. Use user input (shown in blue as an assumption) or a licensed or free quote source, clearly cited.
7. **Cache in layers:** CDN (durable + SWR), then Blobs for raw upstream JSON, then in-memory.

## Open questions for build time
- Source for share price (user input vs. a free quote API and its terms).
- How to handle multi-class share counts (GOOGL/GOOG, BRK-A/B) beyond a warning badge.
- Whether to support 20-F/IFRS filers in v1 (recommendation: detect them and decline politely).
