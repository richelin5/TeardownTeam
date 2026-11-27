# Fixtures (real data, retrieved 2026-11-27)

The cloud dev container cannot reach `data.sec.gov` or `api.stlouisfed.org` (egress proxy refuses them), so all development and tests run against these **real** responses. They were captured via Firecrawl from the official endpoints. Production code still calls SEC/FRED live through the Netlify Function.

| File | What | Source URL |
|---|---|---|
| `sec/company_tickers.json` | Full ticker→CIK map (10,400 rows) | https://www.sec.gov/files/company_tickers.json |
| `sec/submissions-CIK0000320193.json` | Apple submissions (FYE 0925) | https://data.sec.gov/submissions/CIK0000320193.json |
| `sec/submissions-CIK0000789019.json` | Microsoft submissions (FYE 0630) | https://data.sec.gov/submissions/CIK0000789019.json |
| `sec/submissions-CIK0000021344.json` | Coca-Cola submissions (FYE 1231) | https://data.sec.gov/submissions/CIK0000021344.json |
| `sec/companyfacts-CIK*.json` | companyfacts **trimmed** to ~60 relevant us-gaap tags + all `dei` | https://data.sec.gov/api/xbrl/companyfacts/CIK##########.json |
| `sec/raw/companyfacts-CIK*.json.gz` | the **full, untrimmed** companyfacts (use when you need a tag not in the trimmed file) | same |
| `fred/DGS10-observations.json`, `fred/FEDFUNDS-observations.json` | FRED API-shaped observations (desc), real values; holidays = "." | built from https://fred.stlouisfed.org/graph/fredgraph.csv?id=DGS10 / FEDFUNDS |
| `fred/*.csv` | the raw fredgraph CSVs | same |
| `filings/*.md` | Statements from each latest 10-K (income statement, balance sheet, cash flow) as rendered by the SEC filing viewer: the tie-out evidence | URL inside each file |

## Latest filings in the fixtures
| Ticker | Latest 10-K (accn, filed, period end) | Latest 10-Q (accn, filed, period end) |
|---|---|---|
| AAPL | 0000320193-26-000026, 2026-11-03, 2026-09-26 (aapl-20260926.htm) | 0000320193-26-000020, 2026-07-31, 2026-06-27 |
| MSFT | 0001193125-26-323660, 2026-07-29, 2026-06-30 (msft-20260630.htm) | 0001193125-26-436133, 2026-10-28, 2026-09-30 |
| KO | 0001628280-26-010047, 2026-02-20, 2025-12-31 (ko-20251231.htm) | 0001628280-26-067844, 2026-10-28, 2026-10-02 |

## Known data quirks found while capturing (handle these)
- **KO** reports revenue as `Revenues` (not `RevenueFromContractWithCustomerExcludingAssessedTax`).
- **KO** `LongTermDebt`/`LongTermDebtNoncurrent`/`LongTermDebtCurrent` stop at FY2023. Find KO's current debt tags in the raw gz before deciding "not reported".
- **MSFT** has **no** us-gaap D&A total: the cash-flow line "Depreciation, amortization, and other" is the extension `msft:DepreciationAmortizationAndOther` (not in companyfacts). us-gaap `Depreciation` (34,300) + `AmortizationOfIntangibleAssets` (4,700) = 39,000 ≠ 38,534 on the cash-flow statement. This needs a finance-reviewer decision.
- **AAPL** debt = `LongTermDebt` (78,114 = 68,208 non-current + 9,906 current) + `CommercialPaper` (1,997) at 2026-09-26.
- **DGS10** has holiday gaps (2026-10-12, 2026-11-11) encoded as ".".
