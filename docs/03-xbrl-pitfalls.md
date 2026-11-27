# XBRL Pitfalls (and how the resolver handles them)

Raw companyfacts data is **not** a clean time series. Every example below comes from Apple's live `RevenueFromContractWithCustomerExcludingAssessedTax` concept (CIK 320193), pulled 2026-11-27.

## 1. The same period appears many times

Each 10-K re-reports the prior two or three years as comparatives, so one period shows up once per filing that contains it:

| start | end | val | accn | fy | fp | form | frame |
|---|---|---|---|---|---|---|---|
| 2022-09-25 | 2023-09-30 | 383,285,000,000 | 0000320193-23-000106 | 2023 | FY | 10-K | |
| 2022-09-25 | 2023-09-30 | 383,285,000,000 | 0000320193-24-000123 | 2024 | FY | 10-K | |
| 2022-09-25 | 2023-09-30 | 383,285,000,000 | 0000320193-25-000079 | 2025 | FY | 10-K | CY2023 |

**Rule:** deduplicate on `(start, end)`. Keep the fact with the **latest `filed` date**, which is the most recent restated view. Cite the **original** filing too if you want "as first reported" (see Restatements below).

## 2. `fy` and `fp` describe the *filing*, not the period

```
{"start":"2016-09-25","end":"2017-09-30","val":229234000000,"fy":2019,"fp":"FY","form":"10-K"}
```

This is Apple's **FY2017** revenue, tagged `fy: 2019` because it came from the FY2019 10-K's comparative columns. Never group by `fy`. **Derive the period from `start`/`end`** and from the company's fiscal year end in the submissions API.

## 3. Quarterly vs. year-to-date vs. annual

10-Qs report both the three-month quarter and the **year-to-date** figure under the same tag and the same `fp`:

| start | end | val | fp | what it is |
|---|---|---|---|---|
| 2024-12-29 | 2025-03-29 | 95,359,000,000 | Q2 | Q2 FY25 (3 months) |
| 2024-09-29 | 2025-03-29 | 219,659,000,000 | Q2 | 6-month YTD |
| 2024-09-29 | 2025-06-28 | 313,695,000,000 | Q3 | 9-month YTD |
| 2024-09-29 | 2025-09-27 | 416,161,000,000 | FY | FY25 (12 months) |

**Rule:** classify by **duration** (`end − start` in days):

| Days | Class |
|---|---|
| 80–100 | quarter |
| 170–200 | 6-month YTD |
| 260–290 | 9-month YTD |
| 350–380 | annual |

Never use `fp` to decide whether a value is quarterly.

### Q4 is usually not reported, so derive it
No 10-Q exists for Q4, and recent Apple 10-Ks don't tag a standalone Q4 for this concept. So:

```
Q4 FY25 = FY25 − 9M YTD = 416,161 − 313,695 = 102,466 ($M)
```

Label derived values as "derived: FY − 9M YTD". **Don't derive Q4 for instant (balance-sheet) items or for per-share/share-count items.** Q4 EPS ≠ FY EPS − 9M EPS, because share counts change.

### Cash-flow items are YTD only
Cash-flow statements in 10-Qs are **YTD-only**: there's no three-month CFO. A quarterly figure needs differencing (Q2 = 6M − 3M, and so on).

## 4. LTM / TTM construction

The one-pager should show LTM (last twelve months), not just the last fiscal year:

```
LTM = latest FY + current YTD − prior-year comparable YTD
```

Both YTD numbers appear in the latest 10-Q (current and prior-year columns). If the latest filing is a 10-K, LTM = FY. For balance-sheet items, just use the **latest instant**.

## 5. Fiscal years that don't end in December

- Apple ends its FY on the last Saturday of September. Microsoft ends June 30, Walmart Jan 31, Nvidia late January, Oracle May 31.
- **52/53-week years.** Apple's FY2023 ran 2022-09-25 → 2023-09-30 (**53 weeks**), and its Q1 FY23 was 14 weeks. Growth rates are slightly flattered. Flag years with duration > 367 days.
- Label columns with the **fiscal year and period-end date** ("FY25 (Sep-25)"), not a calendar year.
- `submissions.fiscalYearEnd` (`"MMDD"`) tells you the FYE. Decide which fiscal year a period belongs to from its `end` date (the period ending in the FY-end month of year N is FY N; Walmart-style January year-ends are conventionally labeled by the calendar year they **start** in. Check `DocumentFiscalYearFocus` in `dei` if unsure).
- **Frames API alignment is calendar-based.** `frame: "CY2023"` on Apple's FY23 (ending Sep-30) is an approximation. Don't use frames to build a company's own fiscal history.
- **Fiscal-year changes** (8-K Item 5.03) create a transition period of odd length (e.g. 6 months). The duration classifier will spot it. Show it as a separate column or skip it, but never call it a year.

## 6. Tags change between companies and years

- ASC 606 (2018) moved most filers from `SalesRevenueNet`/`Revenues` to `RevenueFromContractWithCustomerExcludingAssessedTax`. A single concept's history can **stop in 2017** while another starts in 2018. Resolve **per period**, then stitch the results together, and record which tag fed each column.
- Companies switch tags for no visible reason (e.g. D&A between `DepreciationDepletionAndAmortization` and `DepreciationAndAmortization`).
- Some numbers are only in **custom extension tags** (`tsla:...`) or have **dimensions** (segments, share classes). Neither appears in companyfacts. When the fallback chain is exhausted, show "Not tagged in XBRL. See filing" with a link, instead of guessing.
- Sign conventions mostly follow the element's balance type (expenses positive, `PaymentsTo…` positive). But `…IncomeLoss` tags are negative for losses, and a few filers get signs wrong. Sanity-check: a margin > 100% or a negative revenue means something is off.

## 7. Restatements and amendments

- A later filing may report a **different `val`** for the same `(start, end)`, after a restatement, a reclassification or discontinued operations. The latest-filed rule gives you the restated number, which is what a banker wants for comparables.
- `10-K/A` and `10-Q/A` forms appear in `form`. Treat them like any other filing and use the latest `filed`.
- Discontinued operations recast prior years. Mixing originally reported FY21 with restated FY22 breaks growth rates. **Take every column of the historical table from the *same latest filing* when possible**, i.e. prefer the 10-K's own comparative columns (filter `accn == latestTenK.accn`) and fall back to older filings only for older years.
- If restated and original values differ by more than 0.5%, add a footnote: "FY22 restated in 10-K filed 2023-11-03 (was $X)."

## 8. Units and scale

- `val` is in **full units** (dollars, shares). Scale for display ($M or $B) **after** calculating.
- Per-share values are under `units["USD-per-shares"]`, and share counts under `units["shares"]`.
- Foreign filers on IFRS (`ifrs-full`) and non-USD units (e.g. `EUR`) exist. 20-F/40-F filers are out of scope for v1: detect them and say so.

## 9. Share counts and multi-class companies

- `dei:EntityCommonStockSharesOutstanding` is per class for Alphabet, Meta, Berkshire and others. Class-level facts carry a dimension and can be **missing from companyfacts**, or only the sum is shown. Market cap = Σ(class shares × class price), and different classes can have very different prices (BRK-A vs BRK-B).
- For v1, use diluted weighted-average shares × price of the queried ticker, and show a warning badge on multi-class names (more than one ticker for the CIK in `company_tickers.json`).
- **Stock splits** restate historical share counts and EPS in later filings. The latest-filed rule handles this, but don't mix pre- and post-split values in one series.

## 10. Industries where the template breaks

| Sector | Issue | Handling |
|---|---|---|
| Banks | No "revenue" or "operating income" in the usual sense; debt is a raw material | Show NII, non-interest income, efficiency ratio; suppress EV/EBITDA |
| Insurers | Premiums, combined ratio | Suppress EBITDA multiples |
| REITs | FFO isn't in XBRL (non-GAAP) | Show revenue and NOI proxies; note it |
| Pre-revenue biotech | Revenue is zero or missing | Show cash runway = cash / quarterly burn |

Detect these by SIC code (e.g. 6020–6029 for banks, 6798 for REITs, 63xx for insurance).

## Checklist for every number shown
1. Tag used (and which fallback rank)
2. Period `start`–`end`, plus its class (Q / YTD / FY / LTM / instant)
3. Accession number, form and filed date, with a link to the filing
4. Derived? If so, the formula
5. Restated vs. original flag, where they differ
