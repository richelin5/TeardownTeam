# Tag coverage: 8 metrics × AAPL / MSFT / KO × 5 FYs

Owner: financial-data-engineer · Date: 2026-11-27 · Source: `fixtures/sec/companyfacts-*.json` (trimmed) and `fixtures/sec/raw/*.json.gz` (full).
Method: 10-K/10-K/A facts only, classified by duration (350–380 days = FY, instants by `end`), deduped per (start,end) by latest `filed`. Values are in $ millions (shares in millions). The accn suffix is in brackets.

## Fiscal years in scope
| Ticker | FYE | Five FYs | Latest 10-K |
|---|---|---|---|
| AAPL | 0925 (52/53-wk, last Sat of Sep) | FY22 (2022-09-24) … FY26 (2026-09-26). FY23 is a **53-week** year (371 days) | 0000320193-26-000026 |
| MSFT | 0630 | FY22 … FY26 (2026-06-30) | 0001193125-26-323660 |
| KO | 1231 | FY21 … FY25 (2025-12-31) | 0001628280-26-010047 |

## Coverage by metric
| Metric | AAPL | MSFT | KO |
|---|---|---|---|
| Revenue | `RevenueFromContractWithCustomerExcludingAssessedTax`, all 5 | same, all 5 | **`Revenues`** (rank 1), all 5 |
| Operating income | `OperatingIncomeLoss`, all 5 | same | same |
| Net income | `NetIncomeLoss`, all 5 | same | same (attributable to KO shareowners: 13,107 FY25, not consolidated 13,137) |
| D&A | `DepreciationDepletionAndAmortization`, all 5 (FY26 13,423 ties to CF) | **none** of DDA / D&A / DAAccretionNet. `Depreciation` + `AmortizationOfIntangibleAssets` exist all 5 (FY26 34,300 + 4,700 = 39,000). CF line 38,534 is `msft:DepreciationAmortizationAndOther` (extension, not in companyfacts) | `DepreciationDepletionAndAmortization`, all 5 (FY25 1,050 ties to CF) |
| Cash | `CashAndCashEquivalentsAtCarryingValue`, all 5 | same | same |
| LT debt (total incl. current) | `LongTermDebt` FY22–FY26 | `LongTermDebt` all 5 | `LongTermDebt` **only to FY23**. FY24–FY25 use `LongTermDebtAndCapitalLeaseObligations` (non-current, 42,119) + `LongTermDebtAndCapitalLeaseObligationsCurrent` (1,822); these are in the trimmed file |
| Short-term borrowings | `CommercialPaper` all 5 | `CommercialPaper` FY23 0, FY24 6,693, FY25 0 (from 25-000011), FY22 and FY26: no fact | `NotesAndLoansPayable` FY22–FY25 (**gz only**). `ShortTermBorrowings` FY20–FY22. `CommercialPaper` is a **subset** of loans & notes payable (FY25 1,495 ⊂ 1,551), so summing would double-count |
| Diluted shares | `WeightedAverageNumberOfDilutedSharesOutstanding`, all 5 | same | same |

## Findings that drive the build
1. **KO revenue** resolves via chain rank 1 (`Revenues`). The chain already handles it.
2. **KO debt:** the "current" debt tags are `LongTermDebtAndCapitalLeaseObligations(+Current)`, which the canonical chain already lists under debt_noncurrent/debt_current. Short-term borrowings must be `NotesAndLoansPayable → ShortTermBorrowings → CommercialPaper`, **first match only, never summed**. `NotesAndLoansPayable` is not in the trimmed fixture, so it was **added to the trimmed fixtures** (copied verbatim from the raw gz).
3. **MSFT D&A** has no us-gaap total. Policy is with the finance-reviewer (see `docs/finance/definitions-v1.md`).
4. **MSFT short-term debt:** FY22 and FY26 have no `CommercialPaper` fact. The FY26 balance sheet shows no short-term debt line, so ST borrowings are absent and total debt = `LongTermDebt`. Treat an absent ST component as 0 only when the LT component exists, and add a note that no short-term borrowings line was tagged.
5. **Finance leases:** AAPL and MSFT `LongTermDebt` excludes finance leases (MSFT FY26 finance lease liability 66,594 is gz-only). KO's `LongTermDebtAndCapitalLeaseObligations` includes them by definition. Noted per company.
6. **Older years:** balance-sheet values older than the latest 10-K's two columns, and income/cash-flow values older than its three columns, come from earlier 10-Ks. Each value cites its own accn.
