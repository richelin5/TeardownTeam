# Independent tie-out, round 2 (commit b31ddc2), 2026-11-27

Re-ran `tests/tieout/independent/dump-api.mjs` + `tieout.mjs` (updated) on the new build; added `missing.test.ts` (mocked missing values) and `render-check.mjs` (Playwright against the built page via scripts/preview-fixtures.mjs).

## Summary
| Ticker | PASS | FAIL |
|---|---|---|
| AAPL | 94 | 0 |
| MSFT | 99 | 0 (3 informational D&A-vs-CF-line rows, FY24-FY26, classified "PASS vs cited inputs; does NOT tie to CF line, disclosed") |
| KO | 94 | 0 |

**Verdict: PASS**, with the MSFT D&A caveat classified as a disclosed computed figure, as instructed.

## Round-2 specifics
- MSFT D&A: label "D&A (computed: depreciation + amortization of intangibles)", status computed, formula `Depreciation + AmortizationOfIntangibleAssets`; each value equals raw 10-K Depreciation + AmortizationOfIntangibleAssets (FY26 34,300 + 4,700 = 39,000). Versus the cash-flow line: FY26 39,000 vs 38,534 (+1.2%), FY25 28,000 vs 29,433 (-4.9%), FY24 20,000 vs 20,958 (-4.6%): DOES NOT TIE, disclosed.
- Disclosure present in API: 5/5 D&A cells and 5/5 EBITDA cells carry the "does not tie to the cash-flow line" note; `warnings` contains the page-level warning. Disclosure present in the rendered MSFT page (text "It does not tie to the cash-flow statement's D&A line..."); absent on AAPL and KO (correct, they tie).
- Total debt (label "Total debt (incl. finance leases)"): AAPL FY26 81,567 = 78,114 + 1,997 + 1,456; FY25 99,887; MSFT FY26 106,888 = 40,294 + 66,594 (BS current LTD 9,227 + LTD 31,067 + raw FinanceLeaseLiability); FY25 89,323; KO 45,492 / 44,522 unchanged. Finance-lease facts were looked up in raw companyfacts (10-K accn) independently; all 5 years' values equal the sum of their cited sources.
- Errors: ZZZZ 404, "BAD TICKER!" 400.
- Mocked missing values (`tests/tieout/independent/missing.test.ts`, 3 tests pass): removing AAPL FY26 OperatingIncomeLoss gives operating income "not reported" (value null), EBITDA "not reported", OI growth/margin and EBITDA growth/margin "n.m." with a note, earlier years untouched; removing all D&A tags for KO gives 5/5 D&A and EBITDA "not reported"; zero latest revenue gives n.m. margins with no Infinity/NaN.
- Rendered page (Playwright, 1280px): D&A, EBITDA, Total debt rows show values matching the API; footnote markers present on every number.
- `npm test` and `npm run build`: see handoff (all pass).

## Evidence tables

### AAPL  (pass 94 / fail 0)

| Metric | FY | Page value ($M) | Filing value ($M) | Source | Result |
|---|---|---|---|---|---|
| status 200 | - | 200 | 200 | handler | PASS |
| name | - | Apple Inc. | Apple Inc. | submissions.name | PASS |
| ticker | - | AAPL | AAPL | request | PASS |
| SIC | - | 3571 | 3571 | submissions.sic | PASS |
| FYE | - | 0925 | 0925 | submissions.fiscalYearEnd | PASS |
| CIK | - | 0000320193 | 0000320193 | fixtures/README | PASS |
| 10-K accn/filed/period/url | - | 0000320193-26-000026 2026-11-03 2026-09-26 aapl-20260926.htm | 0000320193-26-000026 2026-11-03 2026-09-26 aapl-20260926.htm | submissions.filings.recent (first of form) | PASS |
| latest 10-K accn == README | - | 0000320193-26-000026 | 0000320193-26-000026 | fixtures/README.md | PASS |
| 10-Q accn/filed/period/url | - | 0000320193-26-000020 2026-07-31 2026-06-27 aapl-20260627.htm | 0000320193-26-000020 2026-07-31 2026-06-27 aapl-20260627.htm | submissions.filings.recent (first of form) | PASS |
| DGS10 value/date | - | 4.91 @ 2026-11-24 | 4.91 @ 2026-11-24 | fixtures/fred/DGS10-observations.json | PASS |
| FEDFUNDS value/date | - | 3.88 @ 2026-10-01 | 3.88 @ 2026-10-01 (Oct-2026) | fixtures/fred/FEDFUNDS-observations.json | PASS |
| period end (IS header) | FY26 (Sep-26) | 2026-09-26 | 2026-09-26 | R-IS column header | PASS |
| 53-wk flag | FY26 (Sep-26) | 363d weeks53=false | 363d => false | duration > 367d rule | PASS |
| period end (BS header) | FY26 (Sep-26) | 2026-09-26 | 2026-09-26 | R-BS column header | PASS |
| period end (IS header) | FY25 (Sep-25) | 2025-09-27 | 2025-09-27 | R-IS column header | PASS |
| 53-wk flag | FY25 (Sep-25) | 363d weeks53=false | 363d => false | duration > 367d rule | PASS |
| period end (BS header) | FY25 (Sep-25) | 2025-09-27 | 2025-09-27 | R-BS column header | PASS |
| period end (IS header) | FY24 (Sep-24) | 2024-09-28 | 2024-09-28 | R-IS column header | PASS |
| 53-wk flag | FY24 (Sep-24) | 363d weeks53=false | 363d => false | duration > 367d rule | PASS |
| Revenue | FY26 (Sep-26) | 478,834 | 478,834 | R-IS "Net sales" | PASS |
| Revenue | FY25 (Sep-25) | 416,161 | 416,161 | R-IS "Net sales" | PASS |
| Revenue | FY24 (Sep-24) | 391,035 | 391,035 | R-IS "Net sales" | PASS |
| Operating income | FY26 (Sep-26) | 158,063 | 158,063 | R-IS "Operating income" | PASS |
| Operating income | FY25 (Sep-25) | 133,050 | 133,050 | R-IS "Operating income" | PASS |
| Operating income | FY24 (Sep-24) | 123,216 | 123,216 | R-IS "Operating income" | PASS |
| Net income | FY26 (Sep-26) | 132,175 | 132,175 | R-IS "Net income" | PASS |
| Net income | FY25 (Sep-25) | 112,010 | 112,010 | R-IS "Net income" | PASS |
| Net income | FY24 (Sep-24) | 93,736 | 93,736 | R-IS "Net income" | PASS |
| D&A | FY26 (Sep-26) | 13,423 | 13,423 | R-CF "Depreciation and amortization" | PASS |
| D&A | FY25 (Sep-25) | 11,698 | 11,698 | R-CF "Depreciation and amortization" | PASS |
| D&A | FY24 (Sep-24) | 11,445 | 11,445 | R-CF "Depreciation and amortization" | PASS |
| Diluted shares (M) | FY26 (Sep-26) | 14,720.306 | 14,720.306 | R-IS "Diluted (in shares)" | PASS |
| Diluted shares (M) | FY25 (Sep-25) | 15,004.697 | 15,004.697 | R-IS "Diluted (in shares)" | PASS |
| Diluted shares (M) | FY24 (Sep-24) | 15,408.095 | 15,408.095 | R-IS "Diluted (in shares)" | PASS |
| Cash & cash equivalents | FY26 (Sep-26) | 36,305 | 36,305 | R-BS "Cash and cash equivalents" | PASS |
| Cash & cash equivalents | FY25 (Sep-25) | 35,934 | 35,934 | R-BS "Cash and cash equivalents" | PASS |
| Total debt | FY26 (Sep-26) | 81,567 (computed) | 81,567 | R-BS: Commercial paper + Term debt + Term debt + raw FinanceLeaseLiability 1456 (accn 0000320193-26-000026) | PASS |
| Total debt | FY25 (Sep-25) | 99,887 (computed) | 99,887 | R-BS: Commercial paper + Term debt + Term debt + raw FinanceLeaseLiability 1230 (accn 0000320193-25-000079) | PASS |
| Revenue | FY22 (Sep-22) | 394,328 | 394,328 | raw RevenueFromContractWithCustomerExcludingAssessedTax accn 0000320193-24-000123 10-K filed 2024-11-01 | PASS |
| Operating income | FY22 (Sep-22) | 119,437 | 119,437 | raw OperatingIncomeLoss accn 0000320193-24-000123 10-K filed 2024-11-01 | PASS |
| Net income | FY22 (Sep-22) | 99,803 | 99,803 | raw NetIncomeLoss accn 0000320193-24-000123 10-K filed 2024-11-01 | PASS |
| D&A | FY22 (Sep-22) | 11,104 | 11,104 | raw DepreciationDepletionAndAmortization accn 0000320193-24-000123 10-K filed 2024-11-01 | PASS |
| Diluted shares (M) | FY22 (Sep-22) | 16,325.819 | 16,325.819 | raw WeightedAverageNumberOfDilutedSharesOutstanding accn 0000320193-24-000123 10-K filed 2024-11-01 | PASS |
| Cash & cash equivalents | FY22 (Sep-22) | 23,646 | 23,646 | raw CashAndCashEquivalentsAtCarryingValue accn 0000320193-23-000106 | PASS |
| Revenue | FY23 (Sep-23) | 383,285 | 383,285 | raw RevenueFromContractWithCustomerExcludingAssessedTax accn 0000320193-25-000079 10-K filed 2025-10-31 | PASS |
| Operating income | FY23 (Sep-23) | 114,301 | 114,301 | raw OperatingIncomeLoss accn 0000320193-25-000079 10-K filed 2025-10-31 | PASS |
| Net income | FY23 (Sep-23) | 96,995 | 96,995 | raw NetIncomeLoss accn 0000320193-25-000079 10-K filed 2025-10-31 | PASS |
| D&A | FY23 (Sep-23) | 11,519 | 11,519 | raw DepreciationDepletionAndAmortization accn 0000320193-25-000079 10-K filed 2025-10-31 | PASS |
| Diluted shares (M) | FY23 (Sep-23) | 15,812.547 | 15,812.547 | raw WeightedAverageNumberOfDilutedSharesOutstanding accn 0000320193-25-000079 10-K filed 2025-10-31 | PASS |
| Cash & cash equivalents | FY23 (Sep-23) | 29,965 | 29,965 | raw CashAndCashEquivalentsAtCarryingValue accn 0000320193-24-000123 | PASS |
| citation check: 140 SEC sources vs raw (tag,accn,form,filed,period,value,url) | all | 0 bad | 0 bad | raw companyfacts | PASS |
| row labels da / total_debt | - | D&A | Total debt (incl. finance leases) | D&A | Total debt (incl. finance leases) | round-2 ruling | PASS |
| no spurious D&A warning | - | 1 warnings | no D&A-tie warning | profile.warnings | PASS |
| IS rows for latest 3 FY cite latest 10-K accn | FY-2..FY | all | 0000320193-26-000026 | fixtures/README | PASS |
| EBITDA = OI + D&A | FY22 (Sep-22) | 130,541 | 130,541 | R-IS OI + R-CF D&A (older: page inputs) | PASS |
| EBITDA = OI + D&A | FY23 (Sep-23) | 125,820 | 125,820 | R-IS OI + R-CF D&A (older: page inputs) | PASS |
| EBITDA = OI + D&A | FY24 (Sep-24) | 134,661 | 134,661 | R-IS OI + R-CF D&A (older: page inputs) | PASS |
| EBITDA = OI + D&A | FY25 (Sep-25) | 144,748 | 144,748 | R-IS OI + R-CF D&A (older: page inputs) | PASS |
| EBITDA = OI + D&A | FY26 (Sep-26) | 171,486 | 171,486 | R-IS OI + R-CF D&A (older: page inputs) | PASS |
| revenue_growth | FY22 (Sep-22) | 7.8% | 7.8% (394,328/365,817-1) | recomputed | PASS |
| operating_income_growth | FY22 (Sep-22) | 9.6% | 9.6% (119,437/108,949-1) | recomputed | PASS |
| net_income_growth | FY22 (Sep-22) | 5.4% | 5.4% (99,803/94,680-1) | recomputed | PASS |
| ebitda_growth | FY22 (Sep-22) | 8.6% | 8.6% (prior from cited src) | recomputed | PASS |
| operating_margin | FY22 (Sep-22) | 30.3% | 30.3% | recomputed | PASS |
| ebitda_margin | FY22 (Sep-22) | 33.1% | 33.1% | recomputed | PASS |
| net_margin | FY22 (Sep-22) | 25.3% | 25.3% | recomputed | PASS |
| revenue_growth | FY23 (Sep-23) | -2.8% | -2.8% (383,285/394,328-1) | recomputed | PASS |
| operating_income_growth | FY23 (Sep-23) | -4.3% | -4.3% (114,301/119,437-1) | recomputed | PASS |
| net_income_growth | FY23 (Sep-23) | -2.8% | -2.8% (96,995/99,803-1) | recomputed | PASS |
| ebitda_growth | FY23 (Sep-23) | -3.6% | -3.6% | recomputed | PASS |
| operating_margin | FY23 (Sep-23) | 29.8% | 29.8% | recomputed | PASS |
| ebitda_margin | FY23 (Sep-23) | 32.8% | 32.8% | recomputed | PASS |
| net_margin | FY23 (Sep-23) | 25.3% | 25.3% | recomputed | PASS |
| revenue_growth | FY24 (Sep-24) | 2% | 2% (391,035/383,285-1) | recomputed | PASS |
| operating_income_growth | FY24 (Sep-24) | 7.8% | 7.8% (123,216/114,301-1) | recomputed | PASS |
| net_income_growth | FY24 (Sep-24) | -3.4% | -3.4% (93,736/96,995-1) | recomputed | PASS |
| ebitda_growth | FY24 (Sep-24) | 7% | 7% | recomputed | PASS |
| operating_margin | FY24 (Sep-24) | 31.5% | 31.5% | recomputed | PASS |
| ebitda_margin | FY24 (Sep-24) | 34.4% | 34.4% | recomputed | PASS |
| net_margin | FY24 (Sep-24) | 24% | 24% | recomputed | PASS |
| revenue_growth | FY25 (Sep-25) | 6.4% | 6.4% (416,161/391,035-1) | recomputed | PASS |
| operating_income_growth | FY25 (Sep-25) | 8% | 8% (133,050/123,216-1) | recomputed | PASS |
| net_income_growth | FY25 (Sep-25) | 19.5% | 19.5% (112,010/93,736-1) | recomputed | PASS |
| ebitda_growth | FY25 (Sep-25) | 7.5% | 7.5% | recomputed | PASS |
| operating_margin | FY25 (Sep-25) | 32% | 32% | recomputed | PASS |
| ebitda_margin | FY25 (Sep-25) | 34.8% | 34.8% | recomputed | PASS |
| net_margin | FY25 (Sep-25) | 26.9% | 26.9% | recomputed | PASS |
| revenue_growth | FY26 (Sep-26) | 15.1% | 15.1% (478,834/416,161-1) | recomputed | PASS |
| operating_income_growth | FY26 (Sep-26) | 18.8% | 18.8% (158,063/133,050-1) | recomputed | PASS |
| net_income_growth | FY26 (Sep-26) | 18% | 18% (132,175/112,010-1) | recomputed | PASS |
| ebitda_growth | FY26 (Sep-26) | 18.5% | 18.5% | recomputed | PASS |
| operating_margin | FY26 (Sep-26) | 33% | 33% | recomputed | PASS |
| ebitda_margin | FY26 (Sep-26) | 35.8% | 35.8% | recomputed | PASS |
| net_margin | FY26 (Sep-26) | 27.6% | 27.6% | recomputed | PASS |

### MSFT  (pass 99 / fail 0)

| Metric | FY | Page value ($M) | Filing value ($M) | Source | Result |
|---|---|---|---|---|---|
| status 200 | - | 200 | 200 | handler | PASS |
| name | - | MICROSOFT CORP | MICROSOFT CORP | submissions.name | PASS |
| ticker | - | MSFT | MSFT | request | PASS |
| SIC | - | 7372 | 7372 | submissions.sic | PASS |
| FYE | - | 0630 | 0630 | submissions.fiscalYearEnd | PASS |
| CIK | - | 0000789019 | 0000789019 | fixtures/README | PASS |
| 10-K accn/filed/period/url | - | 0001193125-26-323660 2026-07-29 2026-06-30 msft-20260630.htm | 0001193125-26-323660 2026-07-29 2026-06-30 msft-20260630.htm | submissions.filings.recent (first of form) | PASS |
| latest 10-K accn == README | - | 0001193125-26-323660 | 0001193125-26-323660 | fixtures/README.md | PASS |
| 10-Q accn/filed/period/url | - | 0001193125-26-436133 2026-10-28 2026-09-30 msft-20260930.htm | 0001193125-26-436133 2026-10-28 2026-09-30 msft-20260930.htm | submissions.filings.recent (first of form) | PASS |
| DGS10 value/date | - | 4.91 @ 2026-11-24 | 4.91 @ 2026-11-24 | fixtures/fred/DGS10-observations.json | PASS |
| FEDFUNDS value/date | - | 3.88 @ 2026-10-01 | 3.88 @ 2026-10-01 (Oct-2026) | fixtures/fred/FEDFUNDS-observations.json | PASS |
| period end (IS header) | FY26 (Jun-26) | 2026-06-30 | 2026-06-30 | R-IS column header | PASS |
| 53-wk flag | FY26 (Jun-26) | 364d weeks53=false | 364d => false | duration > 367d rule | PASS |
| period end (BS header) | FY26 (Jun-26) | 2026-06-30 | 2026-06-30 | R-BS column header | PASS |
| period end (IS header) | FY25 (Jun-25) | 2025-06-30 | 2025-06-30 | R-IS column header | PASS |
| 53-wk flag | FY25 (Jun-25) | 364d weeks53=false | 364d => false | duration > 367d rule | PASS |
| period end (BS header) | FY25 (Jun-25) | 2025-06-30 | 2025-06-30 | R-BS column header | PASS |
| period end (IS header) | FY24 (Jun-24) | 2024-06-30 | 2024-06-30 | R-IS column header | PASS |
| 53-wk flag | FY24 (Jun-24) | 365d weeks53=false | 365d => false | duration > 367d rule | PASS |
| Revenue | FY26 (Jun-26) | 331,839 | 331,839 | R-IS "Revenue" | PASS |
| Revenue | FY25 (Jun-25) | 281,724 | 281,724 | R-IS "Revenue" | PASS |
| Revenue | FY24 (Jun-24) | 245,122 | 245,122 | R-IS "Revenue" | PASS |
| Operating income | FY26 (Jun-26) | 155,237 | 155,237 | R-IS "Operating income" | PASS |
| Operating income | FY25 (Jun-25) | 128,528 | 128,528 | R-IS "Operating income" | PASS |
| Operating income | FY24 (Jun-24) | 109,433 | 109,433 | R-IS "Operating income" | PASS |
| Net income | FY26 (Jun-26) | 133,749 | 133,749 | R-IS "Net income" | PASS |
| Net income | FY25 (Jun-25) | 101,832 | 101,832 | R-IS "Net income" | PASS |
| Net income | FY24 (Jun-24) | 88,136 | 88,136 | R-IS "Net income" | PASS |
| D&A vs CF line (informational) | FY26 (Jun-26) | 39,000 | 38,534 | R-CF 'Depreciation, amortization, and other' | PASS vs cited inputs; DOES NOT TIE to CF line (1.2%); disclosed |
| D&A | FY26 (Jun-26) | 39,000 (computed) | 39,000 | raw Depreciation 34300 + Amortization 4700 (computed, disclosed) | PASS |
| D&A vs CF line (informational) | FY25 (Jun-25) | 28,000 | 29,433 | R-CF 'Depreciation, amortization, and other' | PASS vs cited inputs; DOES NOT TIE to CF line (-4.9%); disclosed |
| D&A | FY25 (Jun-25) | 28,000 (computed) | 28,000 | raw Depreciation 22000 + Amortization 6000 (computed, disclosed) | PASS |
| D&A vs CF line (informational) | FY24 (Jun-24) | 20,000 | 20,958 | R-CF 'Depreciation, amortization, and other' | PASS vs cited inputs; DOES NOT TIE to CF line (-4.6%); disclosed |
| D&A | FY24 (Jun-24) | 20,000 (computed) | 20,000 | raw Depreciation 15200 + Amortization 4800 (computed, disclosed) | PASS |
| Diluted shares (M) | FY26 (Jun-26) | 7,453 | 7,453 | R-IS "Diluted" | PASS |
| Diluted shares (M) | FY25 (Jun-25) | 7,465 | 7,465 | R-IS "Diluted" | PASS |
| Diluted shares (M) | FY24 (Jun-24) | 7,469 | 7,469 | R-IS "Diluted" | PASS |
| Cash & cash equivalents | FY26 (Jun-26) | 20,935 | 20,935 | R-BS "Cash and cash equivalents" | PASS |
| Cash & cash equivalents | FY25 (Jun-25) | 30,242 | 30,242 | R-BS "Cash and cash equivalents" | PASS |
| Total debt | FY26 (Jun-26) | 106,888 (computed) | 106,888 | R-BS: Current portion of long-term debt + Long-term debt + raw FinanceLeaseLiability 66594 (accn 0001193125-26-323660) | PASS |
| Total debt | FY25 (Jun-25) | 89,323 (computed) | 89,323 | R-BS: Current portion of long-term debt + Long-term debt + raw FinanceLeaseLiability 46172 (accn 0001193125-26-323660) | PASS |
| Revenue | FY22 (Jun-22) | 198,270 | 198,270 | raw RevenueFromContractWithCustomerExcludingAssessedTax accn 0000950170-24-087843 10-K filed 2024-07-30 | PASS |
| Operating income | FY22 (Jun-22) | 83,383 | 83,383 | raw OperatingIncomeLoss accn 0000950170-24-087843 10-K filed 2024-07-30 | PASS |
| Net income | FY22 (Jun-22) | 72,738 | 72,738 | raw NetIncomeLoss accn 0000950170-24-087843 10-K filed 2024-07-30 | PASS |
| D&A | FY22 (Jun-22) | 14,600 (computed, no raw tag) | no 10-K fact for std tags in raw | raw companyfacts | PASS |
| Diluted shares (M) | FY22 (Jun-22) | 7,540 | 7,540 | raw WeightedAverageNumberOfDilutedSharesOutstanding accn 0000950170-24-087843 10-K filed 2024-07-30 | PASS |
| Cash & cash equivalents | FY22 (Jun-22) | 13,931 | 13,931 | raw CashAndCashEquivalentsAtCarryingValue accn 0000950170-23-035122 | PASS |
| Revenue | FY23 (Jun-23) | 211,915 | 211,915 | raw RevenueFromContractWithCustomerExcludingAssessedTax accn 0000950170-25-100235 10-K filed 2025-07-30 | PASS |
| Operating income | FY23 (Jun-23) | 88,523 | 88,523 | raw OperatingIncomeLoss accn 0000950170-25-100235 10-K filed 2025-07-30 | PASS |
| Net income | FY23 (Jun-23) | 72,361 | 72,361 | raw NetIncomeLoss accn 0000950170-25-100235 10-K filed 2025-07-30 | PASS |
| D&A | FY23 (Jun-23) | 13,500 (computed, no raw tag) | no 10-K fact for std tags in raw | raw companyfacts | PASS |
| Diluted shares (M) | FY23 (Jun-23) | 7,472 | 7,472 | raw WeightedAverageNumberOfDilutedSharesOutstanding accn 0000950170-25-100235 10-K filed 2025-07-30 | PASS |
| Cash & cash equivalents | FY23 (Jun-23) | 34,704 | 34,704 | raw CashAndCashEquivalentsAtCarryingValue accn 0000950170-24-087843 | PASS |
| citation check: 163 SEC sources vs raw (tag,accn,form,filed,period,value,url) | all | 0 bad | 0 bad | raw companyfacts | PASS |
| row labels da / total_debt | - | D&A (computed: depreciation + amortization of intangibles) | Total debt (incl. finance leases) | D&A (computed: depreciation + amortization of intangibles) | Total debt (incl. finance leases) | round-2 ruling | PASS |
| D&A disclosure in cell notes (5/5) | all | present | present | API cells | PASS |
| EBITDA cells inherit D&A disclosure (5/5) | all | present | present | API cells | PASS |
| page-level warning present | - | present | present | profile.warnings | PASS |
| IS rows for latest 3 FY cite latest 10-K accn | FY-2..FY | all | 0001193125-26-323660 | fixtures/README | PASS |
| EBITDA = OI + D&A | FY22 (Jun-22) | 97,983 | 97,983 | R-IS OI + R-CF D&A (older: page inputs) | PASS |
| EBITDA = OI + D&A | FY23 (Jun-23) | 102,023 | 102,023 | R-IS OI + R-CF D&A (older: page inputs) | PASS |
| EBITDA = OI + D&A | FY24 (Jun-24) | 129,433 | 129,433 | R-IS OI + R-CF D&A (older: page inputs) | PASS |
| EBITDA = OI + D&A | FY25 (Jun-25) | 156,528 | 156,528 | R-IS OI + R-CF D&A (older: page inputs) | PASS |
| EBITDA = OI + D&A | FY26 (Jun-26) | 194,237 | 194,237 | R-IS OI + R-CF D&A (older: page inputs) | PASS |
| revenue_growth | FY22 (Jun-22) | 18% | 18% (198,270/168,088-1) | recomputed | PASS |
| operating_income_growth | FY22 (Jun-22) | 19.3% | 19.3% (83,383/69,916-1) | recomputed | PASS |
| net_income_growth | FY22 (Jun-22) | 18.7% | 18.7% (72,738/61,271-1) | recomputed | PASS |
| ebitda_growth | FY22 (Jun-22) | 21.2% | 21.2% (prior from cited src) | recomputed | PASS |
| operating_margin | FY22 (Jun-22) | 42.1% | 42.1% | recomputed | PASS |
| ebitda_margin | FY22 (Jun-22) | 49.4% | 49.4% | recomputed | PASS |
| net_margin | FY22 (Jun-22) | 36.7% | 36.7% | recomputed | PASS |
| revenue_growth | FY23 (Jun-23) | 6.9% | 6.9% (211,915/198,270-1) | recomputed | PASS |
| operating_income_growth | FY23 (Jun-23) | 6.2% | 6.2% (88,523/83,383-1) | recomputed | PASS |
| net_income_growth | FY23 (Jun-23) | -0.5% | -0.5% (72,361/72,738-1) | recomputed | PASS |
| ebitda_growth | FY23 (Jun-23) | 4.1% | 4.1% | recomputed | PASS |
| operating_margin | FY23 (Jun-23) | 41.8% | 41.8% | recomputed | PASS |
| ebitda_margin | FY23 (Jun-23) | 48.1% | 48.1% | recomputed | PASS |
| net_margin | FY23 (Jun-23) | 34.1% | 34.1% | recomputed | PASS |
| revenue_growth | FY24 (Jun-24) | 15.7% | 15.7% (245,122/211,915-1) | recomputed | PASS |
| operating_income_growth | FY24 (Jun-24) | 23.6% | 23.6% (109,433/88,523-1) | recomputed | PASS |
| net_income_growth | FY24 (Jun-24) | 21.8% | 21.8% (88,136/72,361-1) | recomputed | PASS |
| ebitda_growth | FY24 (Jun-24) | 26.9% | 26.9% | recomputed | PASS |
| operating_margin | FY24 (Jun-24) | 44.6% | 44.6% | recomputed | PASS |
| ebitda_margin | FY24 (Jun-24) | 52.8% | 52.8% | recomputed | PASS |
| net_margin | FY24 (Jun-24) | 36% | 36% | recomputed | PASS |
| revenue_growth | FY25 (Jun-25) | 14.9% | 14.9% (281,724/245,122-1) | recomputed | PASS |
| operating_income_growth | FY25 (Jun-25) | 17.4% | 17.4% (128,528/109,433-1) | recomputed | PASS |
| net_income_growth | FY25 (Jun-25) | 15.5% | 15.5% (101,832/88,136-1) | recomputed | PASS |
| ebitda_growth | FY25 (Jun-25) | 20.9% | 20.9% | recomputed | PASS |
| operating_margin | FY25 (Jun-25) | 45.6% | 45.6% | recomputed | PASS |
| ebitda_margin | FY25 (Jun-25) | 55.6% | 55.6% | recomputed | PASS |
| net_margin | FY25 (Jun-25) | 36.1% | 36.1% | recomputed | PASS |
| revenue_growth | FY26 (Jun-26) | 17.8% | 17.8% (331,839/281,724-1) | recomputed | PASS |
| operating_income_growth | FY26 (Jun-26) | 20.8% | 20.8% (155,237/128,528-1) | recomputed | PASS |
| net_income_growth | FY26 (Jun-26) | 31.3% | 31.3% (133,749/101,832-1) | recomputed | PASS |
| ebitda_growth | FY26 (Jun-26) | 24.1% | 24.1% | recomputed | PASS |
| operating_margin | FY26 (Jun-26) | 46.8% | 46.8% | recomputed | PASS |
| ebitda_margin | FY26 (Jun-26) | 58.5% | 58.5% | recomputed | PASS |
| net_margin | FY26 (Jun-26) | 40.3% | 40.3% | recomputed | PASS |

### KO  (pass 94 / fail 0)

| Metric | FY | Page value ($M) | Filing value ($M) | Source | Result |
|---|---|---|---|---|---|
| status 200 | - | 200 | 200 | handler | PASS |
| name | - | COCA COLA CO | COCA COLA CO | submissions.name | PASS |
| ticker | - | KO | KO | request | PASS |
| SIC | - | 2080 | 2080 | submissions.sic | PASS |
| FYE | - | 1231 | 1231 | submissions.fiscalYearEnd | PASS |
| CIK | - | 0000021344 | 0000021344 | fixtures/README | PASS |
| 10-K accn/filed/period/url | - | 0001628280-26-010047 2026-02-20 2025-12-31 ko-20251231.htm | 0001628280-26-010047 2026-02-20 2025-12-31 ko-20251231.htm | submissions.filings.recent (first of form) | PASS |
| latest 10-K accn == README | - | 0001628280-26-010047 | 0001628280-26-010047 | fixtures/README.md | PASS |
| 10-Q accn/filed/period/url | - | 0001628280-26-067844 2026-10-28 2026-10-02 ko-20261002.htm | 0001628280-26-067844 2026-10-28 2026-10-02 ko-20261002.htm | submissions.filings.recent (first of form) | PASS |
| DGS10 value/date | - | 4.91 @ 2026-11-24 | 4.91 @ 2026-11-24 | fixtures/fred/DGS10-observations.json | PASS |
| FEDFUNDS value/date | - | 3.88 @ 2026-10-01 | 3.88 @ 2026-10-01 (Oct-2026) | fixtures/fred/FEDFUNDS-observations.json | PASS |
| period end (IS header) | FY25 (Dec-25) | 2025-12-31 | 2025-12-31 | R-IS column header | PASS |
| 53-wk flag | FY25 (Dec-25) | 364d weeks53=false | 364d => false | duration > 367d rule | PASS |
| period end (BS header) | FY25 (Dec-25) | 2025-12-31 | 2025-12-31 | R-BS column header | PASS |
| period end (IS header) | FY24 (Dec-24) | 2024-12-31 | 2024-12-31 | R-IS column header | PASS |
| 53-wk flag | FY24 (Dec-24) | 365d weeks53=false | 365d => false | duration > 367d rule | PASS |
| period end (BS header) | FY24 (Dec-24) | 2024-12-31 | 2024-12-31 | R-BS column header | PASS |
| period end (IS header) | FY23 (Dec-23) | 2023-12-31 | 2023-12-31 | R-IS column header | PASS |
| 53-wk flag | FY23 (Dec-23) | 364d weeks53=false | 364d => false | duration > 367d rule | PASS |
| Revenue | FY25 (Dec-25) | 47,941 | 47,941 | R-IS "Net Operating Revenues" | PASS |
| Revenue | FY24 (Dec-24) | 47,061 | 47,061 | R-IS "Net Operating Revenues" | PASS |
| Revenue | FY23 (Dec-23) | 45,754 | 45,754 | R-IS "Net Operating Revenues" | PASS |
| Operating income | FY25 (Dec-25) | 13,762 | 13,762 | R-IS "Operating Income" | PASS |
| Operating income | FY24 (Dec-24) | 9,992 | 9,992 | R-IS "Operating Income" | PASS |
| Operating income | FY23 (Dec-23) | 11,311 | 11,311 | R-IS "Operating Income" | PASS |
| Net income | FY25 (Dec-25) | 13,107 | 13,107 | R-IS "Net Income Attributable to Shareowners of The Coca-Cola Company" | PASS |
| Net income | FY24 (Dec-24) | 10,631 | 10,631 | R-IS "Net Income Attributable to Shareowners of The Coca-Cola Company" | PASS |
| Net income | FY23 (Dec-23) | 10,714 | 10,714 | R-IS "Net Income Attributable to Shareowners of The Coca-Cola Company" | PASS |
| D&A | FY25 (Dec-25) | 1,050 | 1,050 | R-CF "Depreciation and amortization" | PASS |
| D&A | FY24 (Dec-24) | 1,075 | 1,075 | R-CF "Depreciation and amortization" | PASS |
| D&A | FY23 (Dec-23) | 1,128 | 1,128 | R-CF "Depreciation and amortization" | PASS |
| Diluted shares (M) | FY25 (Dec-25) | 4,313 | 4,313 | R-IS "Average Shares Outstanding — Diluted" | PASS |
| Diluted shares (M) | FY24 (Dec-24) | 4,320 | 4,320 | R-IS "Average Shares Outstanding — Diluted" | PASS |
| Diluted shares (M) | FY23 (Dec-23) | 4,339 | 4,339 | R-IS "Average Shares Outstanding — Diluted" | PASS |
| Cash & cash equivalents | FY25 (Dec-25) | 10,270 | 10,270 | R-BS "Cash and cash equivalents" | PASS |
| Cash & cash equivalents | FY24 (Dec-24) | 10,828 | 10,828 | R-BS "Cash and cash equivalents" | PASS |
| Total debt | FY25 (Dec-25) | 45,492 (computed) | 45,492 | R-BS: Loans and notes payable + Current maturities of long-term debt + Long-term debt | PASS |
| Total debt | FY24 (Dec-24) | 44,522 (computed) | 44,522 | R-BS: Loans and notes payable + Current maturities of long-term debt + Long-term debt | PASS |
| Revenue | FY21 (Dec-21) | 38,655 | 38,655 | raw Revenues accn 0000021344-24-000009 10-K filed 2024-02-20 | PASS |
| Operating income | FY21 (Dec-21) | 10,308 | 10,308 | raw OperatingIncomeLoss accn 0000021344-24-000009 10-K filed 2024-02-20 | PASS |
| Net income | FY21 (Dec-21) | 9,771 | 9,771 | raw NetIncomeLoss accn 0000021344-24-000009 10-K filed 2024-02-20 | PASS |
| D&A | FY21 (Dec-21) | 1,452 | 1,452 | raw DepreciationDepletionAndAmortization accn 0000021344-24-000009 10-K filed 2024-02-20 | PASS |
| Diluted shares (M) | FY21 (Dec-21) | 4,340 | 4,340 | raw WeightedAverageNumberOfDilutedSharesOutstanding accn 0000021344-24-000009 10-K filed 2024-02-20 | PASS |
| Cash & cash equivalents | FY21 (Dec-21) | 9,684 | 9,684 | raw CashAndCashEquivalentsAtCarryingValue accn 0000021344-24-000009 | PASS |
| Revenue | FY22 (Dec-22) | 43,004 | 43,004 | raw Revenues accn 0000021344-25-000011 10-K filed 2025-02-20 | PASS |
| Operating income | FY22 (Dec-22) | 10,909 | 10,909 | raw OperatingIncomeLoss accn 0000021344-25-000011 10-K filed 2025-02-20 | PASS |
| Net income | FY22 (Dec-22) | 9,542 | 9,542 | raw NetIncomeLoss accn 0000021344-25-000011 10-K filed 2025-02-20 | PASS |
| D&A | FY22 (Dec-22) | 1,260 | 1,260 | raw DepreciationDepletionAndAmortization accn 0000021344-25-000011 10-K filed 2025-02-20 | PASS |
| Diluted shares (M) | FY22 (Dec-22) | 4,350 | 4,350 | raw WeightedAverageNumberOfDilutedSharesOutstanding accn 0000021344-25-000011 10-K filed 2025-02-20 | PASS |
| Cash & cash equivalents | FY22 (Dec-22) | 9,519 | 9,519 | raw CashAndCashEquivalentsAtCarryingValue accn 0000021344-25-000011 | PASS |
| citation check: 137 SEC sources vs raw (tag,accn,form,filed,period,value,url) | all | 0 bad | 0 bad | raw companyfacts | PASS |
| row labels da / total_debt | - | D&A | Total debt (incl. finance leases) | D&A | Total debt (incl. finance leases) | round-2 ruling | PASS |
| no spurious D&A warning | - | 0 warnings | no D&A-tie warning | profile.warnings | PASS |
| IS rows for latest 3 FY cite latest 10-K accn | FY-2..FY | all | 0001628280-26-010047 | fixtures/README | PASS |
| EBITDA = OI + D&A | FY21 (Dec-21) | 11,760 | 11,760 | R-IS OI + R-CF D&A (older: page inputs) | PASS |
| EBITDA = OI + D&A | FY22 (Dec-22) | 12,169 | 12,169 | R-IS OI + R-CF D&A (older: page inputs) | PASS |
| EBITDA = OI + D&A | FY23 (Dec-23) | 12,439 | 12,439 | R-IS OI + R-CF D&A (older: page inputs) | PASS |
| EBITDA = OI + D&A | FY24 (Dec-24) | 11,067 | 11,067 | R-IS OI + R-CF D&A (older: page inputs) | PASS |
| EBITDA = OI + D&A | FY25 (Dec-25) | 14,812 | 14,812 | R-IS OI + R-CF D&A (older: page inputs) | PASS |
| revenue_growth | FY21 (Dec-21) | 17.1% | 17.1% (38,655/33,014-1) | recomputed | PASS |
| operating_income_growth | FY21 (Dec-21) | 14.6% | 14.6% (10,308/8,997-1) | recomputed | PASS |
| net_income_growth | FY21 (Dec-21) | 26.1% | 26.1% (9,771/7,747-1) | recomputed | PASS |
| ebitda_growth | FY21 (Dec-21) | 11.6% | 11.6% (prior from cited src) | recomputed | PASS |
| operating_margin | FY21 (Dec-21) | 26.7% | 26.7% | recomputed | PASS |
| ebitda_margin | FY21 (Dec-21) | 30.4% | 30.4% | recomputed | PASS |
| net_margin | FY21 (Dec-21) | 25.3% | 25.3% | recomputed | PASS |
| revenue_growth | FY22 (Dec-22) | 11.3% | 11.3% (43,004/38,655-1) | recomputed | PASS |
| operating_income_growth | FY22 (Dec-22) | 5.8% | 5.8% (10,909/10,308-1) | recomputed | PASS |
| net_income_growth | FY22 (Dec-22) | -2.3% | -2.3% (9,542/9,771-1) | recomputed | PASS |
| ebitda_growth | FY22 (Dec-22) | 3.5% | 3.5% | recomputed | PASS |
| operating_margin | FY22 (Dec-22) | 25.4% | 25.4% | recomputed | PASS |
| ebitda_margin | FY22 (Dec-22) | 28.3% | 28.3% | recomputed | PASS |
| net_margin | FY22 (Dec-22) | 22.2% | 22.2% | recomputed | PASS |
| revenue_growth | FY23 (Dec-23) | 6.4% | 6.4% (45,754/43,004-1) | recomputed | PASS |
| operating_income_growth | FY23 (Dec-23) | 3.7% | 3.7% (11,311/10,909-1) | recomputed | PASS |
| net_income_growth | FY23 (Dec-23) | 12.3% | 12.3% (10,714/9,542-1) | recomputed | PASS |
| ebitda_growth | FY23 (Dec-23) | 2.2% | 2.2% | recomputed | PASS |
| operating_margin | FY23 (Dec-23) | 24.7% | 24.7% | recomputed | PASS |
| ebitda_margin | FY23 (Dec-23) | 27.2% | 27.2% | recomputed | PASS |
| net_margin | FY23 (Dec-23) | 23.4% | 23.4% | recomputed | PASS |
| revenue_growth | FY24 (Dec-24) | 2.9% | 2.9% (47,061/45,754-1) | recomputed | PASS |
| operating_income_growth | FY24 (Dec-24) | -11.7% | -11.7% (9,992/11,311-1) | recomputed | PASS |
| net_income_growth | FY24 (Dec-24) | -0.8% | -0.8% (10,631/10,714-1) | recomputed | PASS |
| ebitda_growth | FY24 (Dec-24) | -11% | -11% | recomputed | PASS |
| operating_margin | FY24 (Dec-24) | 21.2% | 21.2% | recomputed | PASS |
| ebitda_margin | FY24 (Dec-24) | 23.5% | 23.5% | recomputed | PASS |
| net_margin | FY24 (Dec-24) | 22.6% | 22.6% | recomputed | PASS |
| revenue_growth | FY25 (Dec-25) | 1.9% | 1.9% (47,941/47,061-1) | recomputed | PASS |
| operating_income_growth | FY25 (Dec-25) | 37.7% | 37.7% (13,762/9,992-1) | recomputed | PASS |
| net_income_growth | FY25 (Dec-25) | 23.3% | 23.3% (13,107/10,631-1) | recomputed | PASS |
| ebitda_growth | FY25 (Dec-25) | 33.8% | 33.8% | recomputed | PASS |
| operating_margin | FY25 (Dec-25) | 28.7% | 28.7% | recomputed | PASS |
| ebitda_margin | FY25 (Dec-25) | 30.9% | 30.9% | recomputed | PASS |
| net_margin | FY25 (Dec-25) | 27.3% | 27.3% | recomputed | PASS |

NOTE not-reported cells in the three profiles: 0; format.ts mentions "not reported": true
