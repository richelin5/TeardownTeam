# v1 metric definitions and labels: finance-reviewer ruling

Reviewer: finance-reviewer · Date: 2026-11-27 · Applies to: `src/data/` resolver and every label in the UI.
Authority: `banker-metric-definitions` skill. Where the user's v1 scope is more specific (exact EBITDA label, "not reported" wording), the user's scope wins.

## Units and display
- Banner: "$ in millions, except per-share data; shares in millions". Values are stored in full units and rounded only for display.
- Negatives in parentheses. Percentages to 1 decimal. Missing values show **"not reported"** (user wording; overrides "—"/"unavailable").
- "n.m." (not meaningful) for growth when the prior value ≤ 0, and for margins when revenue ≤ 0.

## Fiscal-year labels
- A fiscal year is identified by its **period end date** (duration 350–380 days), never by the XBRL `fy`/`fp` fields.
- Label = `FY` + the two-digit year of the period end + ` (Mon-YY)` of the end date, e.g. `FY26 (Sep-26)`, `FY26 (Jun-26)`, `FY25 (Dec-25)`.
- A duration > 367 days is flagged "53-week fiscal year" (AAPL FY23: 2022-09-25 → 2023-09-30, 371 days).

## Metric rulings
| Row label (exact) | Definition | Tags (priority) | Status |
|---|---|---|---|
| Revenue | Total net revenue | `RevenueFromContractWithCustomerExcludingAssessedTax` → `Revenues` → `RevenueFromContractWithCustomerIncludingAssessedTax` → `SalesRevenueNet` | reported |
| Operating income | Operating income as reported (= EBIT for v1) | `OperatingIncomeLoss` | reported |
| Net income | Net income attributable to the parent | `NetIncomeLoss` → `NetIncomeLossAvailableToCommonStockholdersBasic` → `ProfitLoss` (note "incl. NCI") | reported |
| D&A | Depreciation, depletion & amortization from the cash-flow statement | `DepreciationDepletionAndAmortization` → `DepreciationAndAmortization` → `DepreciationAmortizationAndAccretionNet` → computed `Depreciation + AmortizationOfIntangibleAssets` | reported (or computed, see MSFT) |
| **EBITDA (computed: operating income + D&A)** | Operating income + D&A, unadjusted (no SBC, restructuring or impairment add-backs) | inputs above | computed, always |
| Cash & cash equivalents | Cash and cash equivalents on the balance sheet at FY end (excludes short-term investments/marketable securities; v1 shows no net debt) | `CashAndCashEquivalentsAtCarryingValue` → `CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents` (note "incl. restricted cash") | reported |
| Total debt | Short-term borrowings + current portion of long-term debt + long-term debt, as presented on the balance sheet at FY end. **Excludes operating leases.** Finance leases are included only where the company's debt line includes them (KO tags `LongTermDebtAndCapitalLeaseObligations`; noted). | LT debt incl. current: `LongTermDebt`, else `LongTermDebtNoncurrent`/`LongTermDebtAndCapitalLeaseObligations` + `LongTermDebtCurrent`/`LongTermDebtAndCapitalLeaseObligationsCurrent`. Short-term borrowings: **first of** `NotesAndLoansPayable` → `ShortTermBorrowings` → `CommercialPaper` (never summed; KO's commercial paper is inside loans & notes payable) | computed when > 1 input, reported when a single fact |
| Diluted shares (weighted avg.) | Weighted-average diluted shares for the fiscal year (the EPS denominator), not period-end shares outstanding | `WeightedAverageNumberOfDilutedSharesOutstanding` → `WeightedAverageNumberOfShareOutstandingBasicAndDiluted` | reported |
| Revenue growth / Operating income growth / EBITDA growth / Net income growth | (Value_FY / Value_FY−1) − 1 for the same metric, consecutive fiscal years | inputs above | computed |
| Operating margin / EBITDA margin / Net margin | Metric / Revenue, same fiscal year | inputs above | computed |

## Ruling: MSFT D&A (and therefore MSFT EBITDA)
Microsoft's cash-flow line "Depreciation, amortization, and other" ($38,534M in FY26) is the company extension `msft:DepreciationAmortizationAndOther`. It is not in companyfacts, and it is **not** pure D&A: it includes "other" items. us-gaap `Depreciation` ($34,300M) and `AmortizationOfIntangibleAssets` ($4,700M) are disclosed in the notes (rounded to $100M) for all five years.

**Decision: show MSFT D&A as a computed value, `Depreciation + AmortizationOfIntangibleAssets`**, with `status: "computed"` and this note on every MSFT D&A cell, carried into EBITDA:
> "Computed: Depreciation + Amortization of intangible assets (note disclosures, rounded to $0.1bn). Microsoft does not tag a us-gaap D&A total; its cash-flow line 'Depreciation, amortization, and other' ($38,534M FY26) uses a company extension tag and includes other items, so it is not used."

Rationale: the computed figure is conceptually D&A, every input is a sourced us-gaap fact, and the label is honest. "Not reported" would hide a well-sourced figure. The fallback applies only when **both** inputs exist for the same fiscal year, and never when a us-gaap D&A total exists (so AAPL and KO always use `DepreciationDepletionAndAmortization`). QA ties the computed value to its two cited facts, not to the cash-flow line, and records the 466M difference from the CF line as explained.

## Ruling: KO total debt
KO's `LongTermDebt` family stops at FY23. From FY24 the balance sheet uses `LongTermDebtAndCapitalLeaseObligations` (42,119) and `…Current` (1,822), plus "Loans and notes payable" `NotesAndLoansPayable` (1,551). **KO FY25 total debt = 1,551 + 1,822 + 42,119 = 45,492.** Commercial paper (1,495) is a component of loans and notes payable and must not be added again. Note on KO FY24–FY25: "Long-term debt lines include finance lease obligations as tagged by the company."

## Ruling: AAPL total debt
`LongTermDebt` (78,114 = 68,208 non-current + 9,906 current) + `CommercialPaper` (1,997) = **80,111** at 2026-09-26. Finance leases are excluded (Apple reports them in other liabilities).

## Sanity checks (fail closed → "not reported" plus a warning)
- Revenue ≤ 0 for a non-financial company → revenue and margins not reported.
- |margin| > 100% → flagged in warnings (not suppressed).
- Debt double count: never add both `LongTermDebt` and its components; never add `CommercialPaper` when `NotesAndLoansPayable`/`ShortTermBorrowings` was used.

## Out of scope in v1 (must not appear)
"Adjusted EBITDA", EV, multiples, net debt, LTM. Banks/insurers (SIC 6020–6029, 63xx) get EBITDA "n.m." with the note "not meaningful for financial institutions".
