---
name: banker-metric-definitions
description: Canonical investment-banking definitions, labels and display rules for every Company Teardown metric (EBITDA, EBIT, FCF, net debt, enterprise value, multiples, margins, credit stats, LTM, n.m. rules, and which figures must be labeled computed). Use when defining, implementing, labeling, reviewing or testing any metric.
---

# Banker metric definitions

These are how a bulge-bracket analyst would define each metric. The finance-reviewer is the final authority. Any change here needs their sign-off.

| Metric | Label on page | Definition | Status |
|---|---|---|---|
| Revenue | Revenue | Total net revenue per the income statement | reported |
| Revenue growth | % growth | (Rev_t / Rev_t−1) − 1, same period class | computed |
| Gross profit | Gross profit | Revenue − cost of revenue (reported if tagged) | reported/computed |
| EBIT | EBIT | `OperatingIncomeLoss` (operating income as reported) | reported |
| D&A | D&A | Depreciation, depletion & amortization from the cash-flow statement | reported |
| **EBITDA** | **EBITDA (computed)** | EBIT + D&A. Unadjusted: no add-backs for SBC, restructuring or impairments | **computed, always labeled** |
| Net income | Net income | `NetIncomeLoss`, attributable to the parent | reported |
| Diluted EPS | Diluted EPS | As reported (`EarningsPerShareDiluted`) | reported |
| CFO | Cash from operations | As reported | reported |
| Capex | Capex | Purchases of PP&E; shown as a negative/outflow | reported |
| **FCF** | **Free cash flow (computed)** | CFO − Capex | **computed** |
| FCF conversion | FCF / Net income | | computed |
| Margins | x% margin | Metric / Revenue, same period | computed |
| Total debt | Total debt | ST borrowings + current LTD + LT debt (excl. operating leases; finance leases shown separately) | computed |
| Cash | Cash & ST investments | Cash & equivalents + ST investments/marketable securities (current) | computed |
| **Net debt** | **Net debt (computed)** | Total debt − Cash & ST investments | **computed** |
| Equity value | Equity value | Price × diluted shares | computed (price = user input) |
| **Enterprise value** | **Enterprise value (computed)** | Equity value + Total debt + Preferred + NCI − Cash & ST inv. | **computed** |
| EV / Revenue, EV / EBITDA | x.0x | EV / LTM metric (and / latest FY) | computed |
| P / E | x.0x | Price / diluted EPS (LTM) | computed |
| Net debt / EBITDA | x.0x | | computed |
| EBITDA / Interest | x.0x | EBITDA / interest expense | computed |
| LTM | LTM Mon-YY | FY + YTD − prior YTD | computed (period) |

## Display rules
- Units banner: "$ in millions, except per-share data". Calculate in full units, round only for display.
- Negatives in parentheses: (1,234). Margins to 1 decimal: 23.4%. Multiples to 1 decimal with an "x": 12.3x.
- **n.m.** when a multiple's denominator ≤ 0 (negative EBITDA or earnings), a margin's revenue ≤ 0, or a multiple > 100x (with a tooltip). "—" when the data is unavailable.
- Columns: FY-2, FY-1, FY (A = actual), then LTM shaded. Headers use fiscal labels: "FY25A (Sep-25)".
- Hard-coded inputs (user-entered price, assumptions) in **blue**. Formulas and derived numbers in black.
- Never show "Adjusted EBITDA". That's a non-GAAP company figure, not in XBRL.
- EV and the multiple's denominator must be consistent (both exclude operating leases).
- Banks/insurers: EBITDA, EV/EBITDA and net debt are **n.m.**, noted "not meaningful for financial institutions".
