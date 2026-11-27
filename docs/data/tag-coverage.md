# Tag coverage: 8 metrics × AAPL / MSFT / KO × 5 FYs

Updated 2026-11-27 (fix round 1): finance leases, commercial-paper check and short-term investments added; MSFT D&A tie gap restated in both directions.

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
| Finance lease liability (added to total debt) | `FinanceLeaseLiability` all 5 (941 / 1,024 / 896 / 1,230 / 1,456); `…Current` + `…Noncurrent` also tagged (FY26 700 + 756) | `FinanceLeaseLiability` all 5 (14,902 / 17,067 / 27,145 / 46,172 / 66,594); no current/non-current split tagged | **none** of `FinanceLeaseLiability*`. Finance leases sit inside `LongTermDebtAndCapitalLeaseObligations(+Current)`; FY23 `LongTermDebt` 37,507 = 35,547 + 1,960 under those tags |
| Commercial paper vs ST borrowings line (check) | CP is the ST line itself | CP is the ST line itself | CP ≤ chosen line every year: FY21 2,462 ≤ 3,307 (`ShortTermBorrowings`); FY22 2,146 ≤ 2,373; FY23 4,209 ≤ 4,557; FY24 1,139 ≤ 1,499; FY25 1,495 ≤ 1,551 (`NotesAndLoansPayable`) |
| Short-term investments (cash note only) | `MarketableSecuritiesCurrent` (FY26 20,417) | `ShortTermInvestments` (FY26 55,908) | `OtherShortTermInvestments` (FY25 3,602); current "Marketable securities" 1,934 is `MarketableSecurities` (not current-specific, not quantified) |

## Findings that drive the build
1. **KO revenue** resolves via chain rank 1 (`Revenues`). The chain already handles it.
2. **KO debt:** the "current" debt tags are `LongTermDebtAndCapitalLeaseObligations(+Current)`, which the canonical chain already lists under debt_noncurrent/debt_current. Short-term borrowings must be `NotesAndLoansPayable → ShortTermBorrowings → CommercialPaper`, **first match only, never summed**. `NotesAndLoansPayable` is not in the trimmed fixture, so it was **added to the trimmed fixtures** (copied verbatim from the raw gz).
3. **MSFT D&A** has no us-gaap total. It is computed as `Depreciation + AmortizationOfIntangibleAssets` (rounded note disclosures) and labeled computed. It does **not** tie to the CF extension line: computed minus CF = −958 (FY24), −1,433 (FY25), +466 (FY26). FY22–FY23 (14,600 / 13,500) have no statement in the fixtures to compare. See `docs/finance/definitions-v1.md` (draft).
4. **MSFT short-term debt:** FY22 and FY26 have no `CommercialPaper` fact. The FY26 balance sheet shows no short-term debt line, so ST borrowings are absent and total debt = `LongTermDebt`. Treat an absent ST component as 0 only when the LT component exists, and add a note that no short-term borrowings line was tagged.
5. **Finance leases (round 1):** total debt now includes them for every company. AAPL and MSFT `LongTermDebt` excludes them, so `FinanceLeaseLiability` is added (AAPL FY26 81,567; MSFT FY26 106,888). KO's debt lines include them (FY24+ tags by definition; FY23 comparative identical), so nothing is added (KO FY25 45,492 unchanged). `FinanceLeaseLiability` (AAPL, MSFT) and `OtherShortTermInvestments` (KO), plus `AvailableForSaleSecuritiesDebtSecuritiesCurrent` (AAPL, no facts in range), were added to the trimmed fixtures verbatim from the raw gz. The trimmed fixtures now contain every resolver tag that exists in the raw file (a unit test checks that resolving the trimmed raw file gives the identical table).
6. **Older years:** balance-sheet values older than the latest 10-K's two columns, and income/cash-flow values older than its three columns, come from earlier 10-Ks. Each value cites its own accn.
