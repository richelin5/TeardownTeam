---
name: one-pager-layout
description: Layout, sections and formatting conventions for the Company Teardown one-page profile (header, business description, key financials, EV bridge, multiples, credit stats, filings, rates strip, footnotes, print CSS). Use when designing, building, reviewing or testing the profile page.
---

# One-pager layout

Full research: `docs/05-ib-one-pager.md`.

## Grid (landscape US Letter, two columns)
```
HEADER: Name (EXCH: TICKER) · HQ · SIC · FYE · filer status      [$ in millions, except per share]
LEFT 55%                                   | RIGHT 45%
 Business description (3–5 lines, sourced) | Market data & EV bridge (price → equity value → EV)
 Key financials: FY-2 FY-1 FY  LTM         | Valuation: EV/Rev, EV/EBITDA, P/E (LTM and FY)
   Revenue, % growth, Gross profit/%,      | Credit: Total debt/EBITDA, Net debt/EBITDA, EBITDA/Interest
   EBITDA (computed)/%, EBIT/%, NI/%, EPS, | Recent filings (10-K, 10-Q, key 8-Ks with item names)
   CFO, Capex, FCF (computed), conversion  | Rates (FRED): 10Y UST, Fed funds range, IG/HY OAS
FOOTER: numbered sources & notes · data retrieved <timestamp> · "Not investment advice"
```

## Rules
- Every number is right-aligned, uses tabular figures, and has a footnote marker or hover/click popover with its sources (the `source-citation` skill).
- Computed figures say "(computed)" in the label, and the popover shows the formula.
- Typography: one sans-serif face, 9–10 pt tables, bold totals, thin rules, the LTM column shaded.
- Banking color code: blue = hard-coded input, black = calculated.
- States: loading skeleton, "ticker not found" (with suggestions), "not supported" (foreign filer/IFRS), partial data (unavailable cells show "—" with a reason), upstream rate-limited (retry message).
- `@media print`: hide controls, keep it on one page, convert footnote popovers to a numbered endnote list.
- Accessibility: tables use `<th scope>`, popovers are keyboard reachable, contrast ≥ 4.5:1, nothing relies on color alone.
- Phone width: sections stack and tables scroll horizontally inside their own container. The page never scrolls sideways.
