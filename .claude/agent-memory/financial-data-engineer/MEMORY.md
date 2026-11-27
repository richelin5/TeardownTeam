# financial-data-engineer: knowledge folder

**Scope:** EDGAR/FRED integrations, tag mapping, period resolution.

This file loads into my prompt at startup (first 200 lines / 25 KB). I keep it short and curated, and put longer notes in sibling files in this folder, linked from here.

## Read first
- `docs/02-xbrl-tags.md`
- `docs/03-xbrl-pitfalls.md`
- `.claude/skills/xbrl-mapping/tag-chains.md`

## Known facts and decisions (seeded 2026-11-27 from the research docs)
- fy/fp describe the FILING, not the period: Apple's FY2017 revenue is tagged fy=2019. Classify by start/end duration.
- 10-Qs carry both 3-month and YTD values under the same fp. Q4 must be derived (FY − 9M). Cash flow is YTD-only in 10-Qs.
- Apple FY2023 was 53 weeks (2022-09-25 → 2023-09-30). Flag durations > 367 days.
- Apple revenue sample (RevenueFromContractWithCustomerExcludingAssessedTax): FY25 = 416,161,000,000 (accn 0000320193-25-000079, filed 2025-10-31); 9M FY25 = 313,695,000,000, so derived Q4 FY25 = 102,466,000,000.
- SEC: User-Agent required, ≤ 10 req/s. FRED: ≤ 120 req/min, missing values are '.'.

## Learned
<!-- Append dated bullets: - YYYY-MM-DD: <lesson> (why it matters). Remove entries that are no longer true. -->
- 2026-11-27: Finance leases. Total debt = borrowings + finance leases for every company. AAPL/MSFT `LongTermDebt` excludes them (add `FinanceLeaseLiability`: AAPL FY26 1,456, MSFT FY26 66,594 > its 40,294 of debt). KO has no `FinanceLeaseLiability*`; leases are inside `LongTermDebtAndCapitalLeaseObligations(+Current)` from FY24, and FY23 `LongTermDebt` 37,507 = 35,547 + 1,960 under those tags. Verify a LongTermDebt year against the CLO pair for the same date before adding leases (why: avoids a double count).
- 2026-11-27: A tag change is not a definition change. Don't attach per-tag "includes leases" notes that imply a break; write one company-level note, built from the data, on every year (why: finance-reviewer finding 3).
- 2026-11-27: MSFT computed D&A vs the CF extension line: −958 / −1,433 / +466 (FY24-26). Never call it "explained" or quote one year's gap; label it computed, note it, warn on the page (why: cherry-picking was finding 1).
- 2026-11-27: Wrap only real network errors (TypeError, AbortError, TimeoutError) as UpstreamError(svc, 0, "network/timeout"). A RangeError from fetch is a bug and must stay a 500 (the backend test simulates crashes that way).
- 2026-11-27: Keep trimmed fixtures = every resolver tag present in the raw gz (unit test: resolve(trim(raw)) == resolve(fixture)). Otherwise a tag missing from the fixture silently changes the answer.
- 2026-11-27: Growth/margin with a missing base, non-consecutive years or a financial-institution EBITDA is "n.m." with a reason. "not reported" is only for reported line items.
- 2026-11-27: Round 2 ruling: "missing" beats "n.m.". A growth/margin with no earlier year or a not-reported input is status not-reported ("Not reported: needs ..."). n.m. only for prior <= 0, revenue <= 0 (even after the sanity check withholds revenue), non-consecutive years, financial EBITDA, or an n.m. input. Labels live only in src/contracts/profile.ts (ROW_LABELS, DA_COMPUTED_LABEL) (why: one source of truth; the frontend reads them).
