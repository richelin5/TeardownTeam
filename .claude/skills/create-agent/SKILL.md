---
name: create-agent
description: How to add a new agent (or skill) to the Company Teardown team correctly, following the official Claude Code subagent and skill formats (frontmatter fields, model choice, tool scoping, preloaded skills, a knowledge folder via project memory, and registration with the orchestrator and CLAUDE.md). Use when the team needs a new role or a new shared skill.
argument-hint: "[role to add]"
---

# Create a new agent or skill

Official references (re-read them if anything looks off, as the formats evolve):
- Subagents: https://code.claude.com/docs/en/sub-agents
- Skills: https://code.claude.com/docs/en/skills

## 0. Should this be an agent at all?
Add an agent only when the role needs **its own context, tools or model**, or **its own judgment and memory**. If the need is just knowledge or a procedure that existing agents could follow, add or extend a **skill** instead. Check `CLAUDE.md` → Roster for overlap first. Two agents with fuzzy, overlapping descriptions make delegation worse.

## 1. Agent file: `.claude/agents/<name>.md`
Use the template in [agent-template.md](agent-template.md). Facts from the docs:
- Only `name` and `description` are required. `name` is lowercase-hyphenated, has no `:`, doesn't start with `-`, and is ≤ 256 chars.
- The opening `---` must be the first line, or the file is treated as documentation.
- Field names are camelCase and must match exactly (`disallowedTools`, `maxTurns`, `permissionMode`). **Unknown fields are silently ignored.**
- `description` decides automatic delegation. Write *when to use it*, and add "Use proactively …" if it should be picked without being asked.
- `tools` is an allowlist (it inherits everything if omitted). Give the least privilege that works. Reviewers get no Write/Edit, except that `memory` auto-enables Read/Write/Edit for the memory folder.
- `model`: `sonnet`, `opus`, `haiku`, `fable`, a full id, or `inherit`. Team policy:
  - **opus**: judgment-heavy, high cost of error (architecture, financial correctness, security, orchestration, agent design)
  - **sonnet**: implementation and structured production work (code, specs, tests, configs)
  - **haiku**: high-volume, mechanical, low-risk tasks (formatting, triage, log scanning)
- `effort`: `low` | `medium` | `high` | `xhigh` | `max` (available levels depend on the model). Use `high` for reviewers and architects; omit it otherwise.
- `skills`: a list of skill names to **preload** (their full content is injected at startup; first 32). Skills with `disable-model-invocation: true` can't be preloaded. Always include `teardown-context` and `handoff-protocol`.
- `memory: project` gives the agent a knowledge folder at `.claude/agent-memory/<name>/`. The first 200 lines / 25 KB of its `MEMORY.md` load into the prompt. **Every team agent uses this.**
- `color`: red, blue, green, yellow, purple, orange, pink or cyan.
- Subagents can't spawn subagents beyond the depth limit (3 layers by default). Omit `Agent` from the tools of anyone who shouldn't delegate.

## 2. Knowledge folder: `.claude/agent-memory/<name>/MEMORY.md`
Seed it with: the role's scope, the key docs to read, initial known facts and decisions, and an empty "Learned" section with the instruction to append dated, concise bullets. Keep it under 200 lines and move detail into sibling files that it links to.

## 3. Skill (if needed): `.claude/skills/<skill-name>/SKILL.md`
- Frontmatter fields are lowercase-hyphenated: `name`, `description` (put the key use case first; description + when_to_use are capped at 1,536 chars), `when_to_use`, `argument-hint`, `user-invocable`, `disable-model-invocation`, `allowed-tools`, `context: fork`, `agent`, `paths`, `model`, `effort`.
- Keep `SKILL.md` under 500 lines and put detail in supporting files linked from it.
- Background-knowledge skills: `user-invocable: false`.

## 4. Register the agent
1. Add it to the orchestrator's `tools: Agent(...)` allowlist in `.claude/agents/orchestrator.md`, and to the orchestrator's routing table.
2. Add a row to `CLAUDE.md` → Roster (name, model, why, skills, knowledge folder) and to the file-ownership table in the `team-workflow` skill if it owns paths.
3. Validate: run `python3 .claude/scripts/validate_team.py` (frontmatter parses, required fields, skills exist, memory seeded, orchestrator allowlist complete).

## 5. Report
Use the `handoff-protocol` format. List the new files, why the role was needed, and what overlap you ruled out.
