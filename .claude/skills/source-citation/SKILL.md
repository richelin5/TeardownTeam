---
name: source-citation
description: The provenance contract for Company Teardown. Every metric carries its source (XBRL tag, period, filing, URL) or its formula if computed. Use when producing, transforming, rendering, reviewing or testing any number shown to users.
---

# Source citation contract

Every number in the API response and on the page is a `Metric`, never a bare number.

```ts
type Period = {
  start?: string;        // ISO date; absent for instant (balance-sheet) values
  end: string;           // ISO date
  class: "FY" | "Q" | "YTD6" | "YTD9" | "LTM" | "instant";
  fiscalLabel: string;   // e.g. "FY25 (Sep-25)", "LTM Jun-26"
};

type SecSource = {
  kind: "sec";
  taxonomy: "us-gaap" | "dei";
  tag: string;           // e.g. "RevenueFromContractWithCustomerExcludingAssessedTax"
  fallbackRank: number;  // 0 = preferred tag in the chain
  accn: string;          // "0000320193-25-000079"
  form: string;          // "10-K", "10-Q", "10-K/A"
  filed: string;         // ISO date
  url: string;           // filing index or primary-document URL
};

type FredSource = { kind: "fred"; seriesId: string; observationDate: string; url: string };
type UserInput  = { kind: "user"; note: string; enteredAt: string };   // e.g. share price

type Metric = {
  id: string;                         // "revenue", "ebitda", "ev_ebitda"...
  label: string;                      // banker label, e.g. "EBITDA (computed)"
  value: number | null;               // full units; null = unavailable
  unit: "USD" | "USD/share" | "shares" | "pct" | "x";
  period?: Period;
  status: "reported" | "computed" | "derived-period" | "user-input" | "n.m." | "unavailable";
  sources: (SecSource | FredSource | UserInput)[];   // >= 1 unless unavailable
  formula?: string;                   // required when status is computed or derived-period
  notes?: string[];                   // restatement, 53-week year, basic-not-diluted, ...
};
```

## Rules
1. `status: "reported"` means the value is a single XBRL fact, unmodified apart from scaling.
2. `status: "computed"` means arithmetic across facts (EBITDA, FCF, net debt, EV, margins, multiples, LTM). `formula` is required and must name the inputs, e.g. `"OperatingIncomeLoss + DepreciationDepletionAndAmortization"`. Every input appears in `sources`.
3. `status: "derived-period"` covers Q4 = FY − 9M YTD and quarterly cash flow from YTD differences. The formula is required.
4. `null` values carry `status: "unavailable"` and a note such as "Not tagged in XBRL; see filing" with a link. **Never** fill a gap with an estimate.
5. `n.m.` is a status, not a value. The UI renders "n.m." and the tooltip explains why.
6. URLs: prefer `https://www.sec.gov/Archives/edgar/data/{cik}/{accnNoDashes}/{primaryDocument}`, falling back to `.../{cik}/{accn}-index.htm`. FRED: `https://fred.stlouisfed.org/series/{ID}`.
7. The UI shows a footnote marker or tooltip for **every** metric that resolves to its sources. A rendered number without a footnote is a P0 bug.

## Review checklist
- [ ] No bare numbers anywhere between the resolver and the DOM
- [ ] Every computed metric has a formula naming real tags
- [ ] Labels say "(computed)" where a banker could mistake the figure for a reported one (EBITDA, FCF, net debt, LTM)
- [ ] Period labels use the fiscal calendar
