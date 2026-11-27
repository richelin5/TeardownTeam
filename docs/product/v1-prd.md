# Company Teardown v1: Product Requirements

Owner: product-manager · Date: 2026-11-27 · Status: approved for build

## Problem
An analyst wants a quick, trustworthy snapshot of a US public company: who it is, five years of core financials, and the rate backdrop. Every number has to trace back to an SEC filing or a FRED series. The tool has no paid data and no AI.

## User story
As an analyst, I type a ticker and get, on one page, the company's identity facts, five fiscal years of core financials with growth and margins, two charts, the current 10Y Treasury yield and fed funds rate, and the source of every number. Nothing on the page is guessed.

## In scope (v1)
| # | Feature |
|---|---|
| F1 | Ticker search box (header). Enter key or button submits. The URL reflects the ticker (`/?ticker=AAPL`) so links are shareable. |
| F2 | Company header: name, ticker, CIK, industry (SIC code + description), fiscal year end, links to latest 10-K and latest 10-Q. |
| F3 | Five fiscal years (oldest → newest, left → right) of: Revenue, Operating income, Net income, D&A, **EBITDA (computed: operating income + D&A)**, Cash & cash equivalents, Total debt, Diluted shares. |
| F4 | Growth rates (YoY %) for revenue, operating income, EBITDA and net income. Margins (% of revenue) for operating income, EBITDA and net income. |
| F5 | Two inline-SVG charts: (1) revenue bars by fiscal year; (2) operating, EBITDA and net margin lines by fiscal year. |
| F6 | Macro strip: 10-Year Treasury yield (FRED `DGS10`) and effective federal funds rate (FRED `FEDFUNDS`, monthly average), each with its observation date, attributed to FRED. |
| F7 | Provenance: every number shows form, filing date, accession number and XBRL tag (or FRED series + date) on hover/focus **and** in a sources panel. Computed values show their formula and every input's source. |
| F8 | Missing values render the exact text **"not reported"**, never an estimate, a dash or "unavailable". |
| F9 | Resources page (`/resources.html`) linked from the header and footer. It lists every external doc the project relies on, plus the GitHub repo and the deploy guide. |
| F10 | Error states: invalid ticker (400), unknown ticker (404), upstream failure (502), unsupported filer (422). |
| F11 | Deployable on Netlify: `netlify.toml`, README with a step-by-step deploy guide, env vars `SEC_USER_AGENT`, `FRED_API_KEY`. |

## Out of scope (v1)
Share price, market cap, EV and multiples, LTM and quarterly columns, peers, credit stats, business description, AI summaries (no AI calls anywhere), 20-F/IFRS filers, bank/insurer-specific metrics, user accounts, exports.

## Acceptance criteria (testable)
| ID | Criterion | Verified by |
|---|---|---|
| AC1 | `GET /api/teardown?ticker=AAPL` returns 200 JSON conforming to `src/contracts/profile.ts`, with `company.cik = "0000320193"`, `sic = "3571"`, `fiscalYearEnd = "0925"`. Same for MSFT (`0000789019`, `0630`) and KO (`0000021344`, `1231`). | unit + function tests |
| AC2 | Ticker input is normalized (trim, upper-case, `.`/`/` → `-`). Anything not matching `^[A-Z0-9-]{1,10}$` returns **400** before any upstream call. | function test |
| AC3 | A well-formed ticker not in the SEC map (e.g. `ZZZZZZ`) returns **404** with a JSON error body and no stack trace. | function test |
| AC4 | `latest10K` and `latest10Q` link to `https://www.sec.gov/Archives/edgar/data/{cik}/{accn-no-dashes}/{primaryDocument}` and show their filing date and period. | unit test + tie-out |
| AC5 | Exactly 5 fiscal-year columns, labeled like `FY26 (Sep-26)`, oldest left. AAPL FY22–FY26, MSFT FY22–FY26, KO FY21–FY25. | golden tests |
| AC6 | Each of the 8 metrics × 5 years either has `value` + ≥1 SEC source, or `value: null`, `status: "not-reported"`, and the UI shows "not reported". | contract test + e2e |
| AC7 | The EBITDA row label is exactly `EBITDA (computed: operating income + D&A)`. Its value equals operating income + D&A for the same FY. If either input is missing it is "not reported". | golden test |
| AC8 | Growth = current / prior − 1 for the same metric. It is "n.m." if prior ≤ 0 and "not reported" if either value is missing. Margin = metric / revenue. It is "n.m." if revenue ≤ 0. Shown to 1 decimal. | unit tests |
| AC9 | Every reported number on the page ties to the filing statements in `fixtures/filings/` (or to the cited older 10-K for older years) with **zero unexplained mismatches** for AAPL, MSFT, KO. | QA tie-out reports |
| AC10 | Macro strip shows DGS10 and FEDFUNDS values with observation dates, skipping "." missing observations. If FRED fails, the strip shows "not reported" for that series and the rest of the page still renders. | unit test |
| AC11 | Hovering or focusing any number shows form, filed date, accn and tag. The sources panel lists the same for every number on the page. | e2e |
| AC12 | No secret (`FRED_API_KEY`, `SEC_USER_AGENT` value) appears in `dist/`, in any response body or header, or in logs. | security review + grep |
| AC13 | `npm install`, `npm test`, `npm run typecheck` and `npm run build` succeed. | CI/local |
| AC14 | The page has no horizontal scroll at 390 px width, and prints legibly (controls hidden). | UX review of screenshots |
| AC15 | The Resources page includes the links listed in F9, including `https://github.com/richelin5/TeardownTeam#deploy-to-netlify-step-by-step`. | e2e/manual |
| AC16 | Function responses carry CDN cache headers (success: `s-maxage=3600, stale-while-revalidate=86400, durable`; errors: `s-maxage=60`). | function test |

## Success metric
Three tie-outs (AAPL, MSFT, KO) pass with zero unexplained mismatches, and all reviewers sign off.
