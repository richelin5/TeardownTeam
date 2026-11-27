# v1 metric definitions and labels

**Status: Draft, pending finance-reviewer re-review.** · Drafted by: financial-data-engineer (fix round 1, 2026-11-27), folding in the finance-reviewer's round-1 findings 1–11. Not yet signed off by the finance-reviewer or qa-tester. An earlier version of this file carried a "Reviewer: finance-reviewer" line that the reviewer never gave; that line has been removed.
Applies to: `src/data/` resolver and every label in the UI.
Authority: `banker-metric-definitions` skill. Where the user's v1 scope is more specific (exact EBITDA label, "not reported" wording), the user's scope wins.

## Units and display
- Banner: "$ in millions, except per-share data; shares in millions". Values are stored in full units and rounded only for display.
- Negatives in parentheses. Percentages to 1 decimal. A missing **reported** item shows **"not reported"** (lower case, user wording), with the note "Not tagged in standard XBRL; see filing: <10-K URL>" when the fiscal year's 10-K is known.
- **Missing data shows "not reported"** (user rule), including on computed ratios. A growth or margin that cannot be computed because data is missing (no earlier fiscal year, or an input that is itself "not reported") is `status: "not-reported"` with a reason note, e.g. "Not reported: needs prior-year revenue (no earlier fiscal year in the 10-K data)." or "Not reported: needs FY26 (Jun-26) EBITDA, which is not reported."
- **"n.m."** (not meaningful) only when the data exists but the ratio is meaningless, always with a reason note:
  - growth when the prior value is ≤ 0; margins when revenue ≤ 0;
  - growth across non-consecutive fiscal years (period ends not 350–380 days apart): "n.m.: non-consecutive fiscal years (FY22 (Dec-22) to FY24 (Dec-24))";
  - financial institutions (SIC 6020–6029, 63xx): EBITDA, EBITDA growth and EBITDA margin are all "n.m.: EBITDA is not meaningful for financial institutions.";
  - a growth or margin whose input is itself n.m.

## Fiscal-year labels
- A fiscal year is identified by its **period end date** (duration 350–380 days), never by the XBRL `fy`/`fp` fields.
- Label = `FY` + the two-digit year of the period end + ` (Mon-YY)` of the end date, e.g. `FY26 (Sep-26)`, `FY26 (Jun-26)`, `FY25 (Dec-25)`.
- A duration > 367 days is flagged "53-week fiscal year" (AAPL FY23: 2022-09-25 → 2023-09-30, 371 days). Every growth cell that touches it (that year and the next) carries "Not like-for-like: FY23 (Sep-23) is a 53-week year", and the page warns.

## Metric rulings
| Row label (exact) | Definition | Tags (priority) | Status |
|---|---|---|---|
| Revenue | Total net revenue | `RevenueFromContractWithCustomerExcludingAssessedTax` → `Revenues` → `RevenueFromContractWithCustomerIncludingAssessedTax` → `SalesRevenueNet` | reported |
| Operating income | Operating income as reported (= EBIT for v1) | `OperatingIncomeLoss` | reported |
| Net income | Net income attributable to the parent | `NetIncomeLoss` → `NetIncomeLossAvailableToCommonStockholdersBasic` (note "After preferred dividends; not net income attributable to the parent.") → `ProfitLoss` (note "Includes net income attributable to noncontrolling interests.") | reported |
| D&A, or **D&A (computed: depreciation + amortization of intangibles)** when any year is computed | Depreciation, depletion & amortization from the cash-flow statement | `DepreciationDepletionAndAmortization` → `DepreciationAndAmortization` → `DepreciationAmortizationAndAccretionNet` → computed `Depreciation + AmortizationOfIntangibleAssets` (rank 3) | reported (or computed, see MSFT) |
| **EBITDA (computed: operating income + D&A)** | Operating income + D&A, unadjusted (no SBC, restructuring or impairment add-backs) | inputs above | computed, always |
| Cash & cash equivalents | Cash and cash equivalents on the balance sheet at FY end. Excludes short-term investments; the note quantifies the first matching tag and says other lines are excluded too, e.g. "Excludes short-term investments of $55,908M (us-gaap:ShortTermInvestments, <accn>) and any other investment lines on the balance sheet; see filing." No match: "No short-term investments or current marketable securities tagged at this date; any shown on the balance sheet are excluded." | `CashAndCashEquivalentsAtCarryingValue` → `CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents` (note "Includes restricted cash."). Note only: first of `ShortTermInvestments` → `MarketableSecuritiesCurrent` (AAPL) → `AvailableForSaleSecuritiesDebtSecuritiesCurrent` → `OtherShortTermInvestments` (KO) | reported |
| **Total debt (incl. finance leases)** | Borrowings (short-term borrowings + current portion of long-term debt + long-term debt) **+ finance lease liabilities**, at FY end, for every company. **Excludes operating leases.** | See "Ruling: total debt" | computed when > 1 input, reported when a single fact |
| Diluted shares (weighted avg.) | Weighted-average diluted shares for the fiscal year (the EPS denominator), not period-end shares outstanding | `WeightedAverageNumberOfDilutedSharesOutstanding` → `WeightedAverageNumberOfShareOutstandingBasicAndDiluted` | reported |
| Revenue growth / Operating income growth / EBITDA growth / Net income growth | (Value_FY / Value_FY−1) − 1 for the same metric, consecutive fiscal years only | inputs above | computed |
| Operating margin / EBITDA margin / Net margin | Metric / Revenue, same fiscal year | inputs above | computed |

## Ruling: total debt (finance-reviewer findings 2–4)
Basis: **borrowings + finance lease liabilities, excluding operating leases, for every company.** This is the only basis that is both consistent across companies and feasible from XBRL (KO's finance leases are bundled in its debt tags and cannot be split out), and it matches EBITDA, whose D&A already contains finance-lease amortization.

1. Long-term debt incl. current portion: `LongTermDebt` if tagged at the date; else `LongTermDebtNoncurrent`/`LongTermDebtAndCapitalLeaseObligations` + `LongTermDebtCurrent`/`LongTermDebtAndCapitalLeaseObligationsCurrent`. Never both a total and its components.
2. Short-term borrowings: **first of** `NotesAndLoansPayable` → `ShortTermBorrowings` → `CommercialPaper`, never summed (KO's commercial paper is inside loans and notes payable).
   **Sanity check:** if a `CommercialPaper` fact exists for the date and exceeds the chosen `NotesAndLoansPayable`/`ShortTermBorrowings` value, the subset assumption is broken: the cell gets a "Check: commercial paper … exceeds …" note and the page warns. The value is not silently changed.
3. Finance leases: if no chosen debt line is a `*CapitalLeaseObligations*` tag (and, for a `LongTermDebt` year, the company did not tag `LongTermDebtAndCapitalLeaseObligations` + `…Current` with the **same** total for that date), add instant `FinanceLeaseLiability`, else `FinanceLeaseLiabilityCurrent` + `FinanceLeaseLiabilityNoncurrent` (rank 1), as separate sources.
   - Added: note "Includes finance lease liabilities reported outside the debt lines (us-gaap:FinanceLeaseLiability)."
   - None tagged: note "No finance lease liability tagged." The value is not estimated.
4. Every cell notes "Excludes operating lease liabilities."

Results (verified against the full raw companyfacts):
| | FY-4 | FY-3 | FY-2 | FY-1 | FY |
|---|---|---|---|---|---|
| AAPL (`LongTermDebt` + `CommercialPaper` + `FinanceLeaseLiability`) | 121,010 | 112,112 | 107,525 | 99,887 | **81,567** (78,114 + 1,997 + 1,456) |
| MSFT (`LongTermDebt` [+ `CommercialPaper`] + `FinanceLeaseLiability`) | 64,683 | 64,304 | 78,775 | 89,323 | **106,888** (40,294 + 66,594) |
| KO (debt lines incl. finance leases + loans & notes payable) | 42,761 | 39,149 | 42,064 | 44,522 | **45,492** (42,119 + 1,822 + 1,551; unchanged) |

## Ruling: KO debt and leases (finding 3)
KO's `LongTermDebt` family stops at FY23. From FY24 the balance sheet uses `LongTermDebtAndCapitalLeaseObligations` (42,119) and `…Current` (1,822), plus "Loans and notes payable" `NotesAndLoansPayable` (1,551). A change of tag is not a change of definition: the FY23 comparative is identical under both tags (`LongTermDebt` 37,507 = 35,547 + 1,960). KO tags no separate `FinanceLeaseLiability`, so nothing is added. Every KO total-debt cell carries:
> "The company's debt lines include finance lease obligations (tagged LongTermDebtAndCapitalLeaseObligations from FY24; the FY23 comparative is identical under both tags)."

The resolver builds this note from the data (first year a capital-lease debt tag is chosen; comparatives verified equal). If a comparative differs under the two tags, the note says so with both values and the page warns.

## Ruling: AAPL total debt
`LongTermDebt` (78,114 = 68,208 non-current + 9,906 current) + `CommercialPaper` (1,997) + `FinanceLeaseLiability` (1,456 = 700 current + 756 non-current, reported in Apple's other liabilities) = **81,567** at 2026-09-26.

## Ruling: MSFT D&A (and therefore MSFT EBITDA) (finding 1)
Microsoft's cash-flow line "Depreciation, amortization, and other" is the company extension `msft:DepreciationAmortizationAndOther`. It is not in companyfacts and is not pure D&A. us-gaap `Depreciation` and `AmortizationOfIntangibleAssets` are disclosed in the notes, rounded to $100M, for all five years.

**Decision: keep MSFT D&A as computed, `Depreciation + AmortizationOfIntangibleAssets`**, `status: "computed"`, with:
- Row label "D&A (computed: depreciation + amortization of intangibles)" whenever any D&A cell is computed (computed cells carry that label; reported cells keep "D&A").
- This note on every computed cell, carried into EBITDA:
  > "Computed: us-gaap Depreciation + AmortizationOfIntangibleAssets, both disclosed in the notes rounded to $0.1bn. The company does not tag a us-gaap D&A total. This figure does not tie to the cash-flow line 'Depreciation, amortization, and other' (company extension tag, not in standard XBRL) and can differ from it by several percent in either direction."
  "rounded to $0.1bn" appears only when both inputs are multiples of $100M; otherwise "(values may be rounded)". For filers without a known extension-line name the note says "the cash-flow statement's D&A line".
- A page-level warning when D&A is computed for any year, and a second warning when the D&A row mixes reported and computed years (EBITDA growth cells across the change also get "Not like-for-like: D&A is reported in … and computed in …").

**Rationale (corrected).** The computed figure is conceptually D&A and every input is a sourced us-gaap fact, so it is better than "not reported" as long as it is labeled honestly. It does **not** tie to the cash-flow line, and the gap goes both ways: computed minus CF line = **+466** (FY26: 39,000 vs 38,534), **−1,433** (FY25: 28,000 vs 29,433), **−958** (FY24: 20,000 vs 20,958), i.e. about 5% low in FY24–FY25 and 1% high in FY26. The previous draft cited only the FY26 +466 gap; that understated the issue. QA reports these rows as "PASS vs cited inputs; does NOT tie to CF line (…), disclosed on page", never "EXPLAINED". The fallback applies only when **both** inputs exist for the same fiscal year, and never when a us-gaap D&A total exists (AAPL and KO always use `DepreciationDepletionAndAmortization`).

## Sanity checks (fail closed → "not reported"/"n.m." plus a note or warning, never a silent wrong number)
- Revenue ≤ 0 for a non-financial company → revenue not reported (warning); its margins and revenue growth are n.m. ("revenue is zero or negative"), because the data exists but the ratio is meaningless.
- |margin| > 100% → flagged in warnings (not suppressed).
- Debt double count: never add both `LongTermDebt` and its components; never add `CommercialPaper` when `NotesAndLoansPayable`/`ShortTermBorrowings` was used; never add `FinanceLeaseLiability` when a debt line already includes finance leases.
- Commercial paper > the chosen short-term borrowings line → note + warning (finding 4).

## Out of scope in v1 (must not appear)
"Adjusted EBITDA", EV, multiples, net debt, LTM.

## Resolved reviewer questions (finance-reviewer, round 2)
- (a) us-gaap `MarketableSecurities` is **not** quantified in the cash note, because it is not current-specific (it can include non-current holdings). The note instead says the cash row also excludes "any other investment lines on the balance sheet; see filing". Example: KO's current "Marketable securities" (1,934) is covered by that wording; only `OtherShortTermInvestments` (3,602) is quantified.
- (b) EBITDA with a missing input (operating income or D&A not reported) stays **"not reported"**, with the note "EBITDA needs both operating income and D&A; D&A is not reported." Its growth and margin follow the rule above ("Not reported: needs … EBITDA, which is not reported.").
