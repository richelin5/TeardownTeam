---
name: xbrl-mapping
description: How Company Teardown maps XBRL facts to banker metrics (fallback tag chains, period classification by duration, dedupe by latest filed, Q4 and LTM derivation, fiscal-year labeling, restatements, sector exceptions). Use when writing, reviewing or testing the resolver or any metric's tag mapping.
---

# XBRL mapping and period resolution

Research: `docs/02-xbrl-tags.md` (tags) and `docs/03-xbrl-pitfalls.md` (pitfalls). The canonical tag chains are in [tag-chains.md](tag-chains.md). **Changing them requires finance-reviewer and qa-tester sign-off.**

## Resolution algorithm (per metric, per target period)
1. **Collect** facts for each tag in the chain from `companyfacts.facts["us-gaap"|"dei"][tag].units[unit]`.
2. **Classify** each fact by duration `end − start` (days): 80–100 → Q, 170–200 → YTD6, 260–290 → YTD9, 350–380 → FY; no `start` → instant. Anything else → `irregular` (transition period; never label it FY).
3. **Never** use `fy`/`fp` to identify the period. They describe the *filing* (Apple's FY2017 revenue is tagged `fy: 2019`).
4. **Dedupe** on `(start, end)`: keep the latest `filed`. If an older value differs by more than 0.5%, add a restatement note.
5. **Choose the tag per period**: walk the chain in order and take the first tag that has a fact for that period. Record `fallbackRank`. Tags change over time (ASC 606 in 2018), so different years may use different tags.
6. **Consistency preference**: for historical FY columns, prefer facts whose `accn` is the latest 10-K (its own comparative columns), then fall back to older filings for older years.
7. **Derived periods**:
   - Q4 = FY − YTD9 (duration items only; never for instants, per-share values or share counts)
   - LTM = latest FY + current YTD − prior-year same YTD (both YTDs come from the latest 10-Q)
   - If the latest filing is a 10-K, LTM = FY
   - Balance sheet "current" = latest instant
8. **Fiscal labels**: from the period `end` and `submissions.fiscalYearEnd`, e.g. "FY25 (Sep-25)". Flag 53-week years (duration > 367 days).
9. **Sector guardrails** (by SIC): banks 6020–6029, insurers 63xx, REITs 6798. Suppress EBITDA/EV multiples and show sector metrics or "n.m." with a note.
10. When the chain is exhausted, return `status: "unavailable"` with the note "Not tagged in standard XBRL. See filing" plus a link. Never guess.

## Sanity checks (fail the resolution, don't ship it)
- Revenue ≤ 0 for a non-financial company
- |margin| > 100% (except for tiny revenue)
- Net debt computed with a debt double-count (`DebtCurrent` + `LongTermDebtCurrent` both added; `LongTermDebt` + its current portion)
- Shares differing more than 20% between consecutive quarters without a split note
