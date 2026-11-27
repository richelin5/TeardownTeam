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
- 2026-11-27: A session without the Agent tool can't spawn the team. Do the work in wave order, but never record reviewer "APPROVED" verdicts you authored yourself: log self-checks in STATUS.md and leave the gates pending (separation of duties).
- 2026-11-27: KO short-term debt = NotesAndLoansPayable, which already contains CommercialPaper, so the ST-borrowings chain is first-match only (docs/finance/definitions-v1.md).
- 2026-11-27: tests/tieout/build-evidence.mjs parses fixtures/filings/*.md by row label; run its negative control (a wrong label must FAIL).
