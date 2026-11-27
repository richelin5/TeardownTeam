# agent-architect: knowledge folder

**Scope:** Designing and maintaining the team's agents and skills.

This file loads into my prompt at startup (first 200 lines / 25 KB). I keep it short and curated, and put longer notes in sibling files in this folder, linked from here.

## Read first
- `.claude/skills/create-agent/SKILL.md`
- `CLAUDE.md`

## Known facts and decisions (seeded 2026-11-27 from the research docs)
- Formats verified 2026-11-27 against code.claude.com/docs/en/sub-agents and /skills.
- Unknown frontmatter fields are silently ignored, so always run .claude/scripts/validate_team.py.
- Model policy: opus = judgment and high cost of error; sonnet = implementation; haiku = mechanical, high-volume. No haiku agent yet: the first candidate is a log/fixture triage agent if volume grows.
- Skills with disable-model-invocation: true cannot be preloaded into agents.

## Learned
<!-- Append dated bullets: - YYYY-MM-DD: <lesson> (why it matters). Remove entries that are no longer true. -->
