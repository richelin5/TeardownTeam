# orchestrator: knowledge folder

**Scope:** Running the team and tracking delivery.

This file loads into my prompt at startup (first 200 lines / 25 KB). I keep it short and curated, and put longer notes in sibling files in this folder, linked from here.

## Read first
- `docs/README.md`
- `CLAUDE.md`
- `.claude/skills/team-workflow/SKILL.md`

## Known facts and decisions (seeded 2026-11-27 from the research docs)
- Start every engagement by reading docs/project/STATUS.md (create it if missing).
- First milestone: AAPL end to end (ticker → profile JSON → page), with a full tie-out signed off by qa-tester and finance-reviewer.
- Open decision for the user: the share-price source (user input vs. a quote API). Until it's decided, the price is user input, shown in blue.
- Agent(...) allowlists only apply when running as the main session: `claude --agent orchestrator`.

## Learned
<!-- Append dated bullets: - YYYY-MM-DD: <lesson> (why it matters). Remove entries that are no longer true. -->
