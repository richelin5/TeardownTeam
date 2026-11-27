---
name: handoff-protocol
description: How Company Teardown agents receive work and report back to the orchestrator, using a standard handoff report with status, changes, evidence, risks and next steps. Use at the end of every delegated task.
user-invocable: false
---

# Handoff protocol

## When you receive a task
1. Restate the goal in one line and name the acceptance criteria. If none were given, write them down and state them as assumptions.
2. Check your knowledge folder (`.claude/agent-memory/<you>/MEMORY.md`) and the relevant `docs/` file before starting.
3. Stay inside your lane (see `CLAUDE.md` → Roster). If the task needs another role, say so in your report instead of doing it.

## When you finish, end with exactly this report

```
## Handoff: <agent-name>
**Status:** done | blocked | needs-review | partial
**Goal:** <one line>
**Changes:** <files created/edited, one per line, with a short why>
**Evidence:** <tests run and results, tie-outs, screenshots, links; paste real output, never "should work">
**Decisions:** <anything a future agent must know; propose an ADR if it's architectural>
**Risks / open questions:** <what could be wrong, what you didn't verify>
**Next:** <which agent should act next and on what>
```

## Rules
- Report failures honestly, with the actual error output. "Tests pass" requires having run them.
- Don't claim a number is correct without a tie-out against the filing (`filing-tieout` skill).
- Before you finish, add durable lessons to your knowledge folder: a short dated bullet, with the why.
