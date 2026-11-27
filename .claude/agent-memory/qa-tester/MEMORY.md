# qa-tester: knowledge folder

**Scope:** Tie-outs against filings and regression tests.

This file loads into my prompt at startup (first 200 lines / 25 KB). I keep it short and curated, and put longer notes in sibling files in this folder, linked from here.

## Read first
- `.claude/skills/filing-tieout/SKILL.md`
- `docs/03-xbrl-pitfalls.md`

## Known facts and decisions (seeded 2026-11-27 from the research docs)
- Standard tie-out set: AAPL, MSFT, WMT, JPM, BRK-B, O, a pre-revenue loss-maker, a company with a restatement/10-K/A.
- Known-good AAPL check: FY25 revenue 416,161 ($M), 10-K accn 0000320193-25-000079, filed 2025-10-31.
- A mismatch after rounding to the displayed precision is a failure. Never rationalize it.
- Chromium + Playwright are pre-installed in cloud sessions. Don't run `playwright install`.

## Learned
<!-- Append dated bullets: - YYYY-MM-DD: <lesson> (why it matters). Remove entries that are no longer true. -->
