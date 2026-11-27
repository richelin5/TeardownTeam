# SEC EDGAR APIs

How Company Teardown turns a ticker into filings and financial facts using only free SEC endpoints.

Verified against SEC pages on 2026-11-27 (sources at the bottom).

## TL;DR

| Need | Endpoint | Host |
|---|---|---|
| Ticker → CIK | `https://www.sec.gov/files/company_tickers.json` | www.sec.gov |
| Ticker → CIK + exchange | `https://www.sec.gov/files/company_tickers_exchange.json` | www.sec.gov |
| Company metadata + filing list | `https://data.sec.gov/submissions/CIK##########.json` | data.sec.gov |
| Every XBRL fact for a company | `https://data.sec.gov/api/xbrl/companyfacts/CIK##########.json` | data.sec.gov |
| One concept for one company | `https://data.sec.gov/api/xbrl/companyconcept/CIK##########/us-gaap/{Tag}.json` | data.sec.gov |
| One concept for every company in a period | `https://data.sec.gov/api/xbrl/frames/us-gaap/{Tag}/USD/CY2024.json` | data.sec.gov |
| Link to a filing | `https://www.sec.gov/Archives/edgar/data/{cik}/{accnNoDashes}/{primaryDocument}` | www.sec.gov |

- No API key or authentication.
- **Every request must send a declared `User-Agent`** (see Fair access below).
- **Max 10 requests/second** in total for your app, however many machines it runs on.
- **No CORS.** A browser cannot call `data.sec.gov` directly, so all calls go through our serverless function.
- `##########` is the CIK **zero-padded to 10 digits**, for example `CIK0000320193` for Apple.

## 1. Ticker → CIK mapping

`company_tickers.json` is an object keyed by row index:

```json
{
  "0": {"cik_str": 320193,  "ticker": "AAPL",  "title": "Apple Inc."},
  "1": {"cik_str": 789019,  "ticker": "MSFT",  "title": "MICROSOFT CORP"},
  "2": {"cik_str": 1652044, "ticker": "GOOGL", "title": "Alphabet Inc."},
  "8": {"cik_str": 1067983, "ticker": "BRK-B", "title": "BERKSHIRE HATHAWAY INC"}
}
```

Implementation notes:
- `cik_str` is actually a **number**. Pad it yourself: `String(cik).padStart(10, "0")`.
- Share classes use a **dash**: `BRK-B`, not `BRK.B` or `BRKB`. Normalize user input by upper-casing it and changing `.` and `/` to `-`.
- Several tickers can map to one CIK (GOOGL/GOOG, BRK-A/BRK-B). The financials are the same for all of them, but **share count and price depend on the class**. Handle this explicitly (see pitfalls doc).
- `company_tickers_exchange.json` has the same data in a columnar `fields`/`data` layout, plus the exchange (Nasdaq, NYSE, OTC…). It's useful for flagging OTC names.
- The SEC says it "periodically update[s] these files… but do[es] not guarantee accuracy or scope." Treat a miss as "ticker not found" and suggest a CIK or name search.
- The file is about 1 MB and rarely changes. **Cache it for 24 hours** (in Netlify Blobs or the CDN) instead of fetching it on every lookup.
- An alternative is `https://www.sec.gov/include/ticker.txt` (tab-delimited ticker→CIK).

## 2. Submissions API: company profile and filing index

`GET https://data.sec.gov/submissions/CIK0000320193.json`

Useful top-level fields for the one-pager:

| Field | Use |
|---|---|
| `name`, `formerNames[]` | Company name and its history |
| `tickers[]`, `exchanges[]` | Listing info (arrays line up by position) |
| `sic`, `sicDescription` | Industry classification, for peer grouping |
| `fiscalYearEnd` | `"MMDD"` string, e.g. `"0927"` → FY ends late September |
| `stateOfIncorporation`, `addresses.business` | HQ and domicile |
| `category` | Filer status, e.g. "Large accelerated filer" |
| `entityType`, `ein`, `website` (often empty) | Misc |
| `filings.recent` | **Columnar** arrays: `accessionNumber[]`, `filingDate[]`, `reportDate[]`, `form[]`, `primaryDocument[]`, `isXBRL[]`, `isInlineXBRL[]`, `items[]` … |
| `filings.files[]` | Extra JSON pages for older filings |

`filings.recent` holds at least one year of filings or the 1,000 most recent, whichever is more. Older filings are in `filings.files[]` (each entry has a `name` you fetch from `https://data.sec.gov/submissions/{name}`).

**Building a source link for any number.** Every XBRL fact carries an `accn` (accession number). Strip its dashes and look up the primary document in `filings.recent`:

```
https://www.sec.gov/Archives/edgar/data/320193/000032019325000079/<primaryDocument>
```

The filing index page always works, even without the primary document name:

```
https://www.sec.gov/Archives/edgar/data/320193/0000320193-25-000079-index.htm
```

This is what makes "a source on every number" possible: **fact → accn → filing URL**.

## 3. XBRL Company Facts API

`GET https://data.sec.gov/api/xbrl/companyfacts/CIK0000320193.json`

Returns **every** standard-taxonomy fact the company has ever filed, in one response. It's large (often 2–10 MB for mega-caps), so compress it and cache it.

Shape:

```json
{
  "cik": 320193,
  "entityName": "Apple Inc.",
  "facts": {
    "dei":     { "EntityCommonStockSharesOutstanding": { "label": "...", "units": { "shares": [ ... ] } } },
    "us-gaap": { "Revenues": { "label": "...", "description": "...", "units": { "USD": [ ...facts ] } } }
  }
}
```

Each fact in a `units` array:

| Key | Meaning |
|---|---|
| `start` | Period start (duration facts only; balance-sheet "instant" facts have no `start`) |
| `end` | Period end, or the instant date |
| `val` | The number, in full units (USD, not thousands) |
| `accn` | Accession number of the filing that reported it |
| `fy` | Fiscal year **of the filing**, not of the period |
| `fp` | Fiscal period **of the filing**: `FY`, `Q1`, `Q2`, `Q3` |
| `form` | `10-K`, `10-Q`, `10-K/A`, `8-K`, `20-F`, … |
| `filed` | Filing date |
| `frame` | Present only on the one fact the SEC chose as canonical for a calendar period (`CY2024`, `CY2024Q3`, `CY2024Q3I`) |

Only facts that (1) use a standard taxonomy (`us-gaap`, `ifrs-full`, `dei`, `srt`) and (2) apply to the whole entity (no segment or dimension) are included. **Custom company extension tags (e.g. `aapl:...`) and segment breakdowns are not in these APIs.**

Recommended approach: **fetch companyfacts once per ticker, cache it, and resolve every line item from it locally.** That is one SEC request instead of 10+ companyconcept calls.

## 4. XBRL Company Concept API

`GET https://data.sec.gov/api/xbrl/companyconcept/CIK0000320193/us-gaap/RevenueFromContractWithCustomerExcludingAssessedTax.json`

This is the same data as one entry of companyfacts, plus `cik`, `taxonomy`, `tag`, `label`, `description` and `entityName`. Use it for debugging or for a "show me this concept's full history" drill-down. It returns 404 when the company never used the tag, which is a cheap way to probe tag availability.

## 5. XBRL Frames API (optional, for peers)

`GET https://data.sec.gov/api/xbrl/frames/us-gaap/Revenues/USD/CY2024.json`

Returns one fact per company for a calendar-aligned period:
- `CY2024`: annual (365 ± 30 days)
- `CY2024Q1`: quarterly (91 ± 30 days)
- `CY2024Q1I`: instant (balance sheet)

Units with a denominator use `-per-`, e.g. `USD-per-shares`. This is useful for **peer screens** (all companies with SIC 3571, ranked by revenue). Frames are aligned to the **calendar, not the fiscal year**, so Apple's FY ending in September shows up as "CY2024" only approximately.

## 6. Fair access, User-Agent and rate limits

Straight from the SEC:

> "Current guidelines limit each user to a total of no more than 10 requests per second, regardless of the number of machines used to submit requests."
>
> "Please declare your user agent in request headers": `User-Agent: Sample Company Name AdminContact@<sample company domain>.com`, `Accept-Encoding: gzip, deflate`

What this means for us:
- Set `User-Agent: CompanyTeardown <contact-email>` on **every** request to sec.gov and data.sec.gov. Keep the email in a Netlify env var (`SEC_USER_AGENT`), not in source code.
- Without a declared UA, the SEC returns **403 "Undeclared Automated Tool"**. Exceeding the rate limit can get the IP **temporarily blocked**. Serverless functions share egress IPs with other tenants, which is one more reason to cache aggressively and keep our own request count low.
- Send `Accept-Encoding: gzip, deflate`. Node's `fetch` decompresses automatically.
- Don't set the `Host` header manually. `fetch` does that.
- One profile load needs about 2 SEC calls (submissions + companyfacts) plus the cached ticker map, which is far below 10 rps. Still, wrap SEC calls in a small limiter (e.g. at most 5 concurrent requests, with retry and backoff on 429/503).
- The SEC provides **no technical support** for scripted downloads.

## 7. Why browsers can't call EDGAR (CORS)

> "data.sec.gov does not support Cross Origin Resource Scripting (CORS)."

A `fetch("https://data.sec.gov/...")` from our front end fails the CORS check, because no `Access-Control-Allow-Origin` header is returned. Browsers also don't let page JavaScript set `User-Agent`. So:

```
Browser ──► /api/teardown?ticker=AAPL (our Netlify Function, same origin)
               ├─► www.sec.gov/files/company_tickers.json   (cached 24h)
               ├─► data.sec.gov/submissions/CIK…json        (cached ~1h)
               ├─► data.sec.gov/api/xbrl/companyfacts/CIK…  (cached ~1h)
               └─► api.stlouisfed.org/fred/...              (cached ~1–6h)
           ◄── one normalized JSON profile with source URLs on every field
```

## 8. Freshness

- The submissions API updates within about 1 second of dissemination. The XBRL APIs update within about 1 minute (longer at peak times).
- Bulk ZIPs (`companyfacts.zip`, `submissions.zip`) are rebuilt nightly around 3:00 a.m. ET. They're overkill for an on-demand app, but useful for building a peer database offline.
- EDGAR accepts filings 6:00 a.m.–10:00 p.m. ET on business days. A 1-hour cache TTL is safe. Bust the cache when `filings.recent.accessionNumber[0]` changes.

## Sources

- SEC, EDGAR Application Programming Interfaces: https://www.sec.gov/search-filings/edgar-application-programming-interfaces
- SEC, Accessing EDGAR Data (fair access, UA, ticker files, paths): https://www.sec.gov/search-filings/edgar-search-assistance/accessing-edgar-data
- SEC, Developer Resources (10 req/s): https://www.sec.gov/about/developer-resources
- SEC, Webmaster FAQ, Developers section: https://www.sec.gov/about/webmaster-frequently-asked-questions#developers
- Live sample: https://data.sec.gov/api/xbrl/companyconcept/CIK0000320193/us-gaap/RevenueFromContractWithCustomerExcludingAssessedTax.json
