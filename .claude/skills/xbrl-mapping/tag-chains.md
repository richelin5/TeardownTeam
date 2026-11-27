# Canonical tag chains (priority order)

Source of truth for the resolver. Keep it in sync with `src/data/tagChains.ts`.

| Metric id | Kind | Chain |
|---|---|---|
| revenue | duration | RevenueFromContractWithCustomerExcludingAssessedTax → Revenues → RevenueFromContractWithCustomerIncludingAssessedTax → SalesRevenueNet → (SalesRevenueGoodsNet + SalesRevenueServicesNet) |
| cost_of_revenue | duration | CostOfRevenue → CostOfGoodsAndServicesSold → CostOfGoodsSold |
| gross_profit | duration | GrossProfit → computed: revenue − cost_of_revenue |
| operating_income | duration | OperatingIncomeLoss → computed: revenue − CostsAndExpenses (label as computed) |
| net_income | duration | NetIncomeLoss → NetIncomeLossAvailableToCommonStockholdersBasic → ProfitLoss (note "incl. NCI") |
| da | duration | DepreciationDepletionAndAmortization → DepreciationAndAmortization → DepreciationAmortizationAndAccretionNet → (Depreciation + AmortizationOfIntangibleAssets) |
| interest_expense | duration | InterestExpense → InterestExpenseNonoperating → InterestExpenseDebt |
| eps_diluted | duration, USD-per-shares | EarningsPerShareDiluted → EarningsPerShareBasicAndDiluted |
| cfo | duration (YTD in 10-Q) | NetCashProvidedByUsedInOperatingActivities |
| capex | duration (YTD in 10-Q) | PaymentsToAcquirePropertyPlantAndEquipment → PaymentsToAcquireProductiveAssets |
| cash | instant | CashAndCashEquivalentsAtCarryingValue → CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents (note "incl. restricted") → Cash |
| st_investments | instant | ShortTermInvestments → MarketableSecuritiesCurrent → AvailableForSaleSecuritiesDebtSecuritiesCurrent |
| debt_total_direct | instant | LongTermDebt → DebtAndCapitalLeaseObligations → DebtLongtermAndShorttermCombinedAmount |
| debt_noncurrent | instant | LongTermDebtNoncurrent → LongTermDebtAndCapitalLeaseObligations → LongTermNotesPayable |
| debt_current | instant | LongTermDebtCurrent → LongTermDebtAndCapitalLeaseObligationsCurrent |
| st_borrowings | instant | ShortTermBorrowings → CommercialPaper (sum both if both exist; DebtCurrent only if neither and no debt_current) |
| operating_lease_liab | instant (memo only) | OperatingLeaseLiability |
| nci | instant | MinorityInterest |
| preferred | instant | PreferredStockValue |
| equity | instant | StockholdersEquity |
| shares_diluted_wavg | duration, shares | WeightedAverageNumberOfDilutedSharesOutstanding → WeightedAverageNumberOfShareOutstandingBasicAndDiluted → WeightedAverageNumberOfSharesOutstandingBasic (note "basic") |
| shares_outstanding | instant, dei | dei:EntityCommonStockSharesOutstanding → us-gaap:CommonStockSharesOutstanding |

**Total debt rule:** if `debt_total_direct` exists for the date, use it plus `st_borrowings` (only if not obviously included); otherwise use `debt_noncurrent + debt_current + st_borrowings`. Finance leases are shown separately. Operating leases are a memo line only.
