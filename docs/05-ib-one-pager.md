# What a First-Year IB Analyst Expects on a One-Page Company Profile

The "company profile" or "tear sheet" is the most common page in a pitch book. An MD flips to it to get the whole company in about 30 seconds. A first-year analyst is judged on three things: **it's right, it's sourced, and it's formatted consistently.** Company Teardown should produce that page automatically, using only SEC and FRED data.

## Page layout (landscape, one page)

```
┌──────────────────────────────────────────────────────────────────────────┐
│ APPLE INC. (NASDAQ: AAPL)                              $ in millions,    │
│ Cupertino, CA · SIC 3571 · FYE late Sep · Large accel.  except per share │
├──────────────────────────────┬───────────────────────────────────────────┤
│ BUSINESS DESCRIPTION         │ MARKET DATA / CAPITALIZATION              │
│ 3–5 lines: what they sell,   │ Share price (as of date)     $xxx.xx      │
│ to whom, segments, HQ,       │ × Diluted shares             x,xxx        │
│ employees                    │ = Equity value               xxx,xxx      │
│                              │ + Total debt                 xx,xxx       │
├──────────────────────────────┤ + Pref. + NCI                xxx          │
│ KEY FINANCIALS               │ − Cash & ST inv.            (xx,xxx)      │
│          FY23  FY24  FY25 LTM│ = Enterprise value           xxx,xxx      │
│ Revenue                      │                                           │
│  % growth                    │ VALUATION       LTM      FY               │
│ Gross profit / %             │ EV / Revenue    x.0x     x.0x             │
│ EBITDA / %                   │ EV / EBITDA     x.0x     x.0x             │
│ EBIT / %                     │ P / E           x.0x     x.0x             │
│ Net income / %               ├───────────────────────────────────────────┤
│ Diluted EPS                  │ CREDIT          Net debt / EBITDA  x.0x   │
│ CFO, Capex, FCF / % conv.    │                 EBITDA / Interest  x.0x   │
├──────────────────────────────┼───────────────────────────────────────────┤
│ RECENT FILINGS / EVENTS      │ RATES CONTEXT (FRED)                      │
│ Last 10-K, 10-Q, key 8-Ks    │ 10Y UST · Fed funds · IG/HY OAS           │
├──────────────────────────────┴───────────────────────────────────────────┤
│ Sources & notes: numbered footnotes → SEC filing URLs / FRED series      │
└──────────────────────────────────────────────────────────────────────────┘
```

## Section-by-section expectations

### 1. Header
- Legal name, exchange:ticker, HQ, SIC/industry, fiscal year end, filer category. All of this is in the submissions API.
- **Units banner**: "$ in millions, except per-share data". This is non-negotiable. Mixing units is the #1 analyst error.
- "As of" date for market data, and the date of the latest filing used.

### 2. Business description
- Three to five plain sentences: products and services, customers and end markets, reportable segments, geographic mix, employee count.
- Free source: Item 1 ("Business") of the latest 10-K. Pull a short excerpt or let the user write it. **Never** generate descriptive claims that aren't sourced. If it's auto-summarized, label it and link to Item 1.
- Employees: `dei:EntityNumberOfEmployees` is rarely tagged. It's usually only in the 10-K text.

### 3. Key financials (the core)
- **3 historical fiscal years + LTM** (+ latest quarter vs. the prior-year quarter if space allows).
- Rows: Revenue, % growth, Gross profit and margin, EBITDA and margin, EBIT and margin, Net income and margin, Diluted EPS, CFO, Capex, FCF, FCF conversion (FCF / net income or FCF / EBITDA).
- Column headers carry the **fiscal period-end**: "FY25A (Sep-25)", "LTM Jun-26".
- "A" = actual. Projections ("E") need consensus estimates, which aren't free. Leave them out of v1, or let the user enter them as labeled assumptions.
- Negative numbers in **parentheses**, margins to one decimal, multiples as "12.3x", "n.m." when not meaningful (negative EBITDA, P/E on a loss), and "—" when not available.

### 4. Capitalization and EV bridge
Bankers expect the bridge shown **explicitly**, not just an EV number:

```
Share price × Diluted shares = Equity value
+ Total debt (incl. current portion; finance leases noted)
+ Preferred stock + Non-controlling interest
− Cash, cash equivalents & short-term investments
= Enterprise value
```

- **Share price is the one input SEC/FRED can't provide.** Options: (a) user enters it (simplest and honest), or (b) a free quote source, which brings licensing questions. Whichever we choose, display "Price: $xxx.xx as of {date}, source: {X}".
- Balance-sheet items come from the **latest** 10-Q/10-K balance sheet, so state the date.
- Operating leases are excluded from debt by default (as consistent with EBITDA, not EBITDAR). Show them as a memo line.

### 5. Valuation multiples
- EV / Revenue, EV / EBITDA, P / E, on **both LTM and the latest FY**.
- EV and LTM numerators/denominators must be **consistent**. If EBITDA excludes leases, so does EV.
- Optional: FCF yield (FCF / equity value), dividend yield.

### 6. Credit stats
- Total debt / EBITDA, Net debt / EBITDA, EBITDA / Interest expense, Debt / Total capitalization.
- These matter for leveraged-finance and DCM pages. Include them because XBRL makes them cheap.

### 7. Recent filings / events
- From `submissions.filings.recent`: last 10-K and 10-Q dates, and notable 8-Ks with item codes translated into words (2.02 earnings, 1.01 material agreement, 2.01 M&A completed, 5.02 executive change, 4.02 non-reliance, the last being a red flag).
- Links straight to each filing.

### 8. Rates context (FRED)
- 10Y UST (DGS10), Fed funds target range or effective rate, IG/HY OAS, each with an "as of" date.

### 9. Footnotes and sources: the product's differentiator
- Every number has a superscript footnote, or a hover/click, that resolves to: **filing type, period, filed date, XBRL tag, and URL**. Derived figures show their formula ("EBITDA = EBIT (OperatingIncomeLoss) + D&A (DepreciationDepletionAndAmortization)").
- Disclose definitions: "EBITDA is unadjusted (reported EBIT + D&A); differs from company-reported Adjusted EBITDA."
- A page-level note gives data retrieval timestamps.

## Quality bar: the checks an associate will run
1. **Cross-foot:** EV bridge sums; margins = metric / revenue; growth calculated from the shown figures.
2. **Tie-out:** revenue and net income match the 10-K face. One click on the source should prove it.
3. **Consistency:** the same fiscal calendar in every column; LTM built correctly; no mix of restated and original figures.
4. **Units and signs:** one unit everywhere, parentheses for negatives, capex shown as outflow consistently.
5. **Freshness:** the latest 10-Q is reflected in LTM and the balance sheet. Stale price data is flagged.
6. **Edge cases:** n.m. multiples, banks and insurers without EBITDA, multi-class shares, non-December FYE are all labeled rather than hidden.

## Formatting conventions
- Font: one sans (Arial/Helvetica/Calibri style), 8–10 pt in tables. Right-aligned numbers, tabular figures.
- Hard-coded inputs (e.g. user-entered price) in **blue**, formulas and derived numbers in **black**. This is the standard banking color code; it carries over nicely to the web.
- Light horizontal rules, no heavy gridlines. Bold totals. Shade the LTM column.
- Must **print to one page** (landscape, US Letter) and export cleanly to PDF. Provide `@media print` CSS.

## Out of scope for free data (say so on the page)
- Consensus estimates and forward multiples
- Real-time share price (unless user-provided or licensed)
- Ownership / top holders (13F data is free on EDGAR but heavy; a later version could add it)
- Credit ratings (S&P/Moody's are proprietary)
- Comparable-company trading multiples need peer prices. The Frames API can supply peer **fundamentals** by SIC code, though.
