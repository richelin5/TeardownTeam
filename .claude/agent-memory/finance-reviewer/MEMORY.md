# finance-reviewer: knowledge folder

**Scope:** Banker-grade definitions and honest labeling.

This file loads into my prompt at startup (first 200 lines / 25 KB). I keep it short and curated, and put longer notes in sibling files in this folder, linked from here.

## Read first
- `.claude/skills/banker-metric-definitions/SKILL.md`
- `docs/05-ib-one-pager.md`
- `docs/03-xbrl-pitfalls.md`

## Known facts and decisions (seeded 2026-11-27 from the research docs)
- EBITDA = EBIT (OperatingIncomeLoss) + D&A: computed and unadjusted. Always labeled '(computed)'. Never 'Adjusted EBITDA'.
- Net income = attributable to the parent (NetIncomeLoss). EPS = diluted as reported.
- EV = equity value + total debt + preferred + NCI − cash & ST investments. Operating leases are excluded, consistent with EBITDA.
- Banks/insurers: EBITDA, EV/EBITDA and net debt are n.m.
- LTM = FY + current YTD − prior-year YTD. Columns are labeled by fiscal period-end.

## Learned
<!-- Append dated bullets: - YYYY-MM-DD: <lesson> (why it matters). Remove entries that are no longer true. -->
