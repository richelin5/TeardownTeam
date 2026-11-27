---
name: edgar-api
description: Rules and endpoints for calling SEC EDGAR from Company Teardown (ticker-to-CIK, submissions, companyfacts, companyconcept, frames, required User-Agent, 10 req/s limit, no CORS, caching TTLs, filing URLs). Use when writing, reviewing or testing code that talks to sec.gov or data.sec.gov.
---

# SEC EDGAR integration rules

Full research: `docs/01-sec-edgar-apis.md`.

## Endpoints
| Purpose | URL | Cache TTL |
|---|---|---|
| Ticker → CIK | `https://www.sec.gov/files/company_tickers.json` | 24 h |
| Ticker → CIK + exchange | `https://www.sec.gov/files/company_tickers_exchange.json` | 24 h |
| Metadata + filings | `https://data.sec.gov/submissions/CIK{10-digit}.json` | 1 h |
| All facts | `https://data.sec.gov/api/xbrl/companyfacts/CIK{10-digit}.json` | 6–24 h; bust when the newest accn changes |
| One concept | `https://data.sec.gov/api/xbrl/companyconcept/CIK{10}/us-gaap/{Tag}.json` | debugging only |
| Peer frame | `https://data.sec.gov/api/xbrl/frames/us-gaap/{Tag}/USD/CY2024.json` | 24 h |

## Hard rules
1. **Send a `User-Agent` on every request:** `process.env.SEC_USER_AGENT` (format: `"CompanyTeardown contact@domain"`). Never hard-code the email. A missing UA causes a 403 "Undeclared Automated Tool".
2. **≤ 10 req/s total.** Use a shared limiter (≤ 5 concurrent), and retry 429/503 with exponential backoff and jitter (at most 3 tries).
3. **Server-side only.** No CORS on data.sec.gov. The browser never calls SEC.
4. Send `Accept-Encoding: gzip, deflate`. Don't set `Host`.
5. **One companyfacts call per ticker.** Resolve all metrics locally from it. Don't fan out companyconcept calls.
6. Ticker normalization: upper-case it, change `.` and `/` to `-` (`BRK.B` → `BRK-B`), and validate against `^[A-Z0-9-]{1,10}$`.
7. Pad the CIK: `String(cik_str).padStart(10, "0")`.
8. Flag multi-class issuers: more than one ticker for the same CIK.
9. Build source URLs from `accn` (see the `source-citation` skill). Look up `primaryDocument` in `submissions.filings.recent`.
10. Out of scope for v1: 20-F/40-F/IFRS filers. Detect `ifrs-full` facts or the 20-F form and return a clear "not supported" message.

## Minimal client shape
```ts
export async function secFetch(url: string): Promise<unknown> {
  const res = await limiter(() => fetch(url, {
    headers: { "User-Agent": env.SEC_USER_AGENT, "Accept-Encoding": "gzip, deflate" },
  }));
  if (res.status === 404) throw new NotFoundError(url);
  if (!res.ok) throw new UpstreamError("sec", res.status, url);
  return res.json();
}
```
