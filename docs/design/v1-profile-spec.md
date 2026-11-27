# v1 profile page: design spec

Owner: ux-designer · Date: 2026-11-27 · Inputs: `docs/product/v1-prd.md`, `one-pager-layout` skill, `src/contracts/profile.ts`.

## Pages
- `/` (`index.html`): search + profile. State lives in the URL: `/?ticker=AAPL`.
- `/resources.html`: the links list. Both pages share the header (brand, search on `/` only, "Resources" link) and footer ("Resources" · "Source: SEC EDGAR and FRED, Federal Reserve Bank of St. Louis" · "Not investment advice" · "No AI is used").

## Layout (desktop ≥ 900 px; max width 1100 px, centered)
```
┌ Header: Company Teardown · [ ticker ______ ][Look up] ··········· Resources ┐
│ Fixture-mode banner (only when dataMode = "fixtures")                       │
│ Company header: Apple Inc. (AAPL)                                            │
│   CIK 0000320193 · SIC 3571 Electronic Computers · FYE 09-25 · Nasdaq        │
│   Latest 10-K: filed 2026-11-03, period 2026-09-26 ↗ · Latest 10-Q: … ↗      │
│ Macro strip: 10Y Treasury 4.91% (as of 2026-11-24) · Fed funds 3.88% (Oct-26 avg) │
│ Units banner: "$ in millions, except per-share data; shares in millions"     │
│ Financials table (5 FY columns, oldest → newest)                             │
│   Revenue / growth  · Operating income / growth / margin · D&A ·             │
│   EBITDA (computed: operating income + D&A) / growth / margin ·              │
│   Net income / growth / margin · Cash & cash equivalents · Total debt ·      │
│   Diluted shares (weighted avg.)                                             │
│ Charts (2 columns): [Revenue bars] [Margins: operating, EBITDA, net lines]   │
│ Sources & notes panel (numbered list; each table cell links to its number)   │
└ Footer                                                                       ┘
```

## Table rules
- Right-aligned, tabular figures. Negatives in parentheses. $ and shares in millions with thousands separators and no decimals (shares 1 decimal under 100M not needed in v1).
- Growth and margin rows are indented, italic, smaller; values to 1 decimal with a `%` sign.
- Computed cells (EBITDA, total debt with > 1 input, growth, margins, MSFT D&A) carry a small "c" marker after the number. A legend under the table reads "c = computed; hover a number for its source".
- Missing: the literal text "not reported" in muted grey (not color-only: it's text). "n.m." likewise.
- Column headers: fiscal label, e.g. "FY26 (Sep-26)". A 53-week year gets a "53 wks" sub-label.
- Each value cell is a focusable element (`tabindex=0`). On hover or focus it shows a tooltip: label, value, status, formula (if computed) and, per source: form, filed date, accn, `taxonomy:tag`, period. Escape hides it. Each cell also has a superscript footnote number that links to the sources panel entry.

## Charts (inline SVG, no library)
1. **Revenue** bars by FY. Single hue (accent), value labels above bars in $M, FY labels below. A "not reported" year shows no bar plus a "n/r" label.
2. **Margins** lines: operating (solid), EBITDA (dashed), net (dotted). Different dash patterns plus a legend, so nothing relies on color alone. The y-axis is in % with 0% gridline.
Both charts have `role="img"` and an `aria-label` summarizing the values. They are 100% width of their column and scale with the viewBox.

## States
- Empty (no ticker): a short intro plus example links (AAPL, MSFT, KO).
- Loading: "Loading AAPL…" with `aria-live="polite"`.
- 400: "That doesn't look like a ticker. Use 1–10 letters, digits or '-'."
- 404: "No SEC registrant found for 'XYZ'." (In fixture mode: "Fixture mode serves only AAPL, MSFT and KO.")
- 422: "This filer isn't supported in v1 (foreign/IFRS filer)."
- 502/500: "SEC or FRED didn't respond. Try again in a minute."

## Responsive (390 px)
Header wraps (search on its own row). Company facts stack. The table scrolls horizontally **inside** its own container (`overflow-x: auto`), with the first column sticky. Charts stack to one column. The page never scrolls sideways.

## Print (landscape Letter)
Hide the search, the tooltips and the fixture banner's controls. Keep the table, charts side by side and the sources panel as endnotes in a smaller type. Black on white. Links print with their URL in the sources panel.

## Visual
System sans-serif stack, 14 px base (table 13 px), navy accent `#1f3a5f`, rules `#d0d5dd`, muted text `#5b6472` (contrast ≥ 4.5:1 on white). No dark mode in v1 (backlog).
