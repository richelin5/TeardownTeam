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
