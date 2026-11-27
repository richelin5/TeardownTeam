---
name: filing-tieout
description: Procedure for tying every Company Teardown number back to the actual SEC filing (open the cited 10-K/10-Q, find the line item, compare the value, period and sign, record pass/fail with evidence). Use when testing or reviewing metric correctness, or on request with a ticker.
argument-hint: "[TICKER]"
---

# Filing tie-out

Goal: prove that each number on the page equals the number in the filing it cites, or, for a computed figure, equals the formula applied to cited numbers.

## Procedure (ticker: $ARGUMENTS)
1. Get the profile JSON: run the resolver against fixtures, or `netlify dev` + `curl localhost:8888/api/teardown?ticker=…`.
2. For each **reported** metric:
   a. Open `sources[0].url` (the filing). Find the statement (income statement, balance sheet, cash flow, cover page).
   b. Find the line item. Confirm the **value** (after scaling: the filing says "in millions"), the **period** (column header dates = `period.start/end`), and the **sign**.
   c. Confirm the XBRL tag: inline XBRL viewer, or companyconcept `.../companyconcept/CIK{10}/us-gaap/{tag}.json` with the same `accn`.
3. For each **computed** metric: recompute it from the cited inputs by hand and confirm the formula matches `banker-metric-definitions`.
4. For **derived periods** (Q4, LTM): recompute them from the FY and YTD facts. Confirm the YTD figures come from the latest 10-Q.
5. For **FRED** values: open the series page and confirm the value and observation date.
6. Tolerance: an exact match after rounding to the displayed precision. Any mismatch is a failure. Don't rationalize it.

## Record the results
Write `tests/tieout/<TICKER>-<YYYY-MM-DD>.md`:

| Metric | Period | Page value | Filing value | Source (form, filed, URL) | Result |
|---|---|---|---|---|---|

Then encode the passing values as a golden test (`tests/tieout/<ticker>.test.ts`) against the stored fixture.

## Standard tie-out set (run all of them before a release)
AAPL (Sep FYE, 53-week FY23), MSFT (Jun FYE), WMT (Jan FYE), JPM (bank: EBITDA n.m.), BRK-B (multi-class), O (REIT), a loss-maker (e.g. a pre-revenue biotech), and a company with a recent restatement or 10-K/A.
