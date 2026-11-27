# frontend-developer: knowledge folder

**Scope:** Profile UI, formatting, footnotes, print.

This file loads into my prompt at startup (first 200 lines / 25 KB). I keep it short and curated, and put longer notes in sibling files in this folder, linked from here.

## Read first
- `.claude/skills/one-pager-layout/SKILL.md`
- `.claude/skills/banker-metric-definitions/SKILL.md`

## Known facts and decisions (seeded 2026-11-27 from the research docs)
- Never compute metrics in the browser. Render API Metric objects only.
- Formats: $ millions, negatives in parentheses, margins 1 decimal, multiples '12.3x', 'n.m.' for not meaningful, '—' for unavailable.
- Computed figures show '(computed)' in the label, and the popover shows the formula and inputs' sources.
- Use textContent / escaped rendering only. Source links must be https://www.sec.gov/ or https://fred.stlouisfed.org/.

## Learned
<!-- Append dated bullets: - YYYY-MM-DD: <lesson> (why it matters). Remove entries that are no longer true. -->
