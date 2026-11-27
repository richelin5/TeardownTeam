# XBRL Tags for the One-Pager

Which `us-gaap` (and `dei`) concepts hold each number we show, in **priority order**. The resolver tries each tag in order and uses the first one that has a usable fact for the target period. It always records which tag won, so the source footnote can say "Revenue = `RevenueFromContractWithCustomerExcludingAssessedTax`, 10-K filed 2025-10-31".

> Rule of thumb: there is no single "revenue tag". Companies pick from a family of acceptable concepts, and the choice changes over time (most notably with the ASC 606 adoption in 2018). Always use a **fallback chain**, and pick per period, not per company.

## Income statement (duration facts: have `start` and `end`)

### Revenue
1. `RevenueFromContractWithCustomerExcludingAssessedTax`: the post-ASC 606 standard, used by most companies from FY2018 on
2. `Revenues`: generic total; common for banks, REITs, insurers and pre-2018 filers
3. `RevenueFromContractWithCustomerIncludingAssessedTax`: when excise or sales tax is included in revenue
4. `SalesRevenueNet`: pre-2018 legacy (deprecated)
5. `SalesRevenueGoodsNet` / `SalesRevenueServicesNet`: legacy, sometimes the only revenue tags; sum them if both exist and no total does
6. Sector-specific fallbacks:
   - Banks: `RevenuesNetOfInterestExpense`, or build it from `InterestIncomeExpenseNet` + `NoninterestIncome`
   - Insurers: `Revenues`, `PremiumsEarnedNet`
   - REITs: `Revenues`, `OperatingLeasesIncomeStatementLeaseRevenue`

Watch out: some companies tag `Revenues` **and** `RevenueFromContract…` with different values, where the latter excludes e.g. financing revenue. Prefer the larger, "total" figure that matches the face of the income statement. When the two disagree by more than ~1%, show the one used and flag it.

### Operating income (EBIT proxy)
1. `OperatingIncomeLoss`
2. Fallback: build it as `Revenue − CostsAndExpenses` (when `CostsAndExpenses` exists), or `GrossProfit − OperatingExpenses`
3. Banks and insurers often **do not report operating income**. Show "n.m." rather than inventing a number.

### Net income
1. `NetIncomeLoss`: attributable to the parent. **This is the number to use for EPS and P/E.**
2. `NetIncomeLossAvailableToCommonStockholdersBasic`: after preferred dividends
3. `ProfitLoss`: includes non-controlling interests. Use it only if 1 is missing, and label it as such.

### Depreciation & amortization (for EBITDA)
D&A usually lives in the **cash-flow statement**, not the income statement:
1. `DepreciationDepletionAndAmortization`
2. `DepreciationAndAmortization`
3. `DepreciationAmortizationAndAccretionNet`
4. Sum of parts: `Depreciation` (or `DepreciationNonproduction`) + `AmortizationOfIntangibleAssets`
5. Some companies only tag `CostDepreciationAmortizationAndDepletion`

**EBITDA = OperatingIncomeLoss + D&A.** Label it "EBITDA (reported EBIT + D&A, unadjusted)". It is not the company's adjusted EBITDA, which is a non-GAAP figure that lives in press releases and not in XBRL.

### Other useful income-statement tags
- `GrossProfit` (missing for many service and tech companies; construct it as Revenue − `CostOfRevenue` / `CostOfGoodsAndServicesSold`)
- `InterestExpense` / `InterestExpenseNonoperating` / `InterestExpenseDebt`
- `IncomeTaxExpenseBenefit`
- `IncomeLossFromContinuingOperationsBeforeIncomeTaxesExtraordinaryItemsNoncontrollingInterest` (pre-tax income)
- `EarningsPerShareDiluted` (unit `USD-per-shares`)
- `ResearchAndDevelopmentExpense`, `SellingGeneralAndAdministrativeExpense`

## Cash flow (duration facts)
- Cash from operations: `NetCashProvidedByUsedInOperatingActivities`
- Capex: `PaymentsToAcquirePropertyPlantAndEquipment` (positive number = cash outflow); fallback `PaymentsToAcquireProductiveAssets`
- **FCF = CFO − Capex** (label it as derived)
- Buybacks: `PaymentsForRepurchaseOfCommonStock`
- Dividends: `PaymentsOfDividends` / `PaymentsOfDividendsCommonStock`

## Balance sheet (instant facts: `end` only, no `start`)

### Cash
1. `CashAndCashEquivalentsAtCarryingValue`
2. `CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents`: includes restricted cash; this is the cash-flow-statement total, so label it
3. `Cash`: legacy or small filers
4. Optionally add `ShortTermInvestments` / `MarketableSecuritiesCurrent` / `AvailableForSaleSecuritiesDebtSecuritiesCurrent` to get "cash & ST investments". Show it as a separate line, because bankers net it out case by case.

### Debt
Total debt is rarely one tag. Resolve the pieces and sum them, **avoiding double counts**:

| Component | Tags (priority) |
|---|---|
| Long-term debt, non-current | `LongTermDebtNoncurrent`, `LongTermDebtAndCapitalLeaseObligations`, `LongTermNotesPayable` |
| Current portion of LTD | `LongTermDebtCurrent`, `LongTermDebtAndCapitalLeaseObligationsCurrent` |
| Short-term borrowings / CP | `ShortTermBorrowings`, `CommercialPaper`, `DebtCurrent` |
| Total (if tagged directly) | `LongTermDebt` (= current + non-current), `DebtAndCapitalLeaseObligations`, `DebtLongtermAndShorttermCombinedAmount` |
| Finance leases (optional) | `FinanceLeaseLiabilityNoncurrent` + `FinanceLeaseLiabilityCurrent` |
| Operating leases | `OperatingLeaseLiability`. **Exclude by default** and show as a memo line |

Double-count traps:
- `DebtCurrent` often **already includes** `LongTermDebtCurrent`. Use one or the other.
- `LongTermDebt` already includes the current portion. If it's present, don't add `LongTermDebtCurrent` again.
- Preferred approach: if `LongTermDebt` (or `DebtAndCapitalLeaseObligations`) exists for the period, use it, then add `ShortTermBorrowings` + `CommercialPaper` only if they aren't obviously contained in it. Otherwise, sum non-current + current + short-term.

**Net debt = Total debt − Cash (& ST investments)**, labeled with its components.

### Other balance-sheet tags
- `StockholdersEquity`; `StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest`
- `MinorityInterest` (NCI, needed for EV)
- `PreferredStockValue` (needed for EV)
- `Assets`, `Liabilities`

## Shares

### Diluted weighted-average shares (duration: used for EPS)
1. `WeightedAverageNumberOfDilutedSharesOutstanding`
2. `WeightedAverageNumberOfShareOutstandingBasicAndDiluted`: when basic equals diluted (common for loss-makers)
3. Fallback: `WeightedAverageNumberOfSharesOutstandingBasic`, labeled "basic"

### Point-in-time shares outstanding (instant: used for market cap)
1. `dei:EntityCommonStockSharesOutstanding`: from the cover page of the latest 10-K/10-Q, dated near the filing date. **This is the best figure for market cap.** For multi-class companies there is one fact per class (with dimensions, so they may be missing from companyfacts). See the pitfalls doc.
2. `us-gaap:CommonStockSharesOutstanding`: balance-sheet date

Units are `shares`. Note that `dei` facts sit under `facts.dei`, not `facts["us-gaap"]`.

> Bankers use **diluted shares (treasury stock method) × price** for equity value. XBRL gives weighted-average diluted shares for the period, which is a reasonable free proxy. Label it "diluted weighted-avg shares, latest quarter".

## Cover-page (`dei`) tags worth reading
`EntityRegistrantName`, `TradingSymbol`, `SecurityExchangeName`, `CurrentFiscalYearEndDate` (`--09-27`), `DocumentFiscalYearFocus`, `DocumentFiscalPeriodFocus`, `EntityPublicFloat` (USD, as of the end of Q2), `EntityCommonStockSharesOutstanding`.

## Resolver sketch

```ts
const CHAINS = {
  revenue: ["RevenueFromContractWithCustomerExcludingAssessedTax", "Revenues",
            "RevenueFromContractWithCustomerIncludingAssessedTax", "SalesRevenueNet"],
  operatingIncome: ["OperatingIncomeLoss"],
  netIncome: ["NetIncomeLoss", "NetIncomeLossAvailableToCommonStockholdersBasic", "ProfitLoss"],
  da: ["DepreciationDepletionAndAmortization", "DepreciationAndAmortization",
       "DepreciationAmortizationAndAccretionNet"],
  cash: ["CashAndCashEquivalentsAtCarryingValue",
         "CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents", "Cash"],
  dilutedShares: ["WeightedAverageNumberOfDilutedSharesOutstanding",
                  "WeightedAverageNumberOfShareOutstandingBasicAndDiluted"],
};

// For each metric and target period: walk the chain and return
// { value, tag, accn, form, filed, start, end, sourceUrl }.
// Never return a bare number.
```

## Sources
- SEC EDGAR API docs (standard-taxonomy, entity-wide facts only): https://www.sec.gov/search-filings/edgar-application-programming-interfaces
- US GAAP Financial Reporting Taxonomy (element definitions, deprecations): https://www.fasb.org/xbrl and https://xbrlview.fasb.org
- Element names were cross-checked against live companyfacts output (e.g. Apple CIK 320193).
