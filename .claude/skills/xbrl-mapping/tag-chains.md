# Canonical tag chains (priority order)

Source of truth for the resolver. Keep it in sync with `src/data/tagChains.ts`.

| Metric id | Kind | Chain |
|---|---|---|
| revenue | duration | RevenueFromContractWithCustomerExcludingAssessedTax → Revenues → RevenueFromContractWithCustomerIncludingAssessedTax → SalesRevenueNet → (SalesRevenueGoodsNet + SalesRevenueServicesNet) |
| cost_of_revenue | duration | CostOfRevenue → CostOfGoodsAndServicesSold → CostOfGoodsSold |
| gross_profit | duration | GrossProfit → computed: revenue − cost_of_revenue |
| operating_income | duration | OperatingIncomeLoss → computed: revenue − CostsAndExpenses (label as computed) |
| net_income | duration | NetIncomeLoss → NetIncomeLossAvailableToCommonStockholdersBasic (note "After preferred dividends; not net income attributable to the parent.") → ProfitLoss (note "incl. NCI") |
| da | duration | DepreciationDepletionAndAmortization → DepreciationAndAmortization → DepreciationAmortizationAndAccretionNet → (Depreciation + AmortizationOfIntangibleAssets) |
| interest_expense | duration | InterestExpense → InterestExpenseNonoperating → InterestExpenseDebt |
| eps_diluted | duration, USD-per-shares | EarningsPerShareDiluted → EarningsPerShareBasicAndDiluted |
| cfo | duration (YTD in 10-Q) | NetCashProvidedByUsedInOperatingActivities |
| capex | duration (YTD in 10-Q) | PaymentsToAcquirePropertyPlantAndEquipment → PaymentsToAcquireProductiveAssets |
| cash | instant | CashAndCashEquivalentsAtCarryingValue → CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents (note "incl. restricted") → Cash |
| st_investments | instant | ShortTermInvestments → MarketableSecuritiesCurrent → AvailableForSaleSecuritiesDebtSecuritiesCurrent → OtherShortTermInvestments (v1: note on the cash row only, first match quantified) |
| debt_total_direct | instant | LongTermDebt (v1 resolver uses LongTermDebt only; DebtAndCapitalLeaseObligations → DebtLongtermAndShorttermCombinedAmount not wired) |
| debt_noncurrent | instant | LongTermDebtNoncurrent → LongTermDebtAndCapitalLeaseObligations → LongTermNotesPayable |
| debt_current | instant | LongTermDebtCurrent → LongTermDebtAndCapitalLeaseObligationsCurrent |
| st_borrowings | instant | NotesAndLoansPayable → ShortTermBorrowings → CommercialPaper, **first match only, never summed**. Sanity check: if CommercialPaper > the chosen NotesAndLoansPayable/ShortTermBorrowings, note + warning (CP is assumed to be a subset) |
| finance_lease | instant | FinanceLeaseLiability → (FinanceLeaseLiabilityCurrent + FinanceLeaseLiabilityNoncurrent); added to total debt unless a debt line already includes finance leases |
| operating_lease_liab | instant (memo only) | OperatingLeaseLiability |
| nci | instant | MinorityInterest |
| preferred | instant | PreferredStockValue |
| equity | instant | StockholdersEquity |
| shares_diluted_wavg | duration, shares | WeightedAverageNumberOfDilutedSharesOutstanding → WeightedAverageNumberOfShareOutstandingBasicAndDiluted → WeightedAverageNumberOfSharesOutstandingBasic (note "basic") |
| shares_outstanding | instant, dei | dei:EntityCommonStockSharesOutstanding → us-gaap:CommonStockSharesOutstanding |

**Total debt rule (incl. finance leases; draft ruling in `docs/finance/definitions-v1.md`, pending finance-reviewer + qa-tester sign-off):** if `debt_total_direct` exists for the date, use it; otherwise `debt_noncurrent + debt_current`. Add `st_borrowings` (first match). Then add `finance_lease` unless a chosen debt tag contains `CapitalLeaseObligations`, or the date's `LongTermDebt` equals `LongTermDebtAndCapitalLeaseObligations + …Current` for the same date (the LongTermDebt line already includes finance leases, e.g. KO FY23). Note "Includes finance lease liabilities reported outside the debt lines (us-gaap:FinanceLeaseLiability)" when added, "No finance lease liability tagged." when none. Operating leases are always excluded.
