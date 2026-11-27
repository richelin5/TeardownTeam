# Agent template (copy into .claude/agents/<name>.md)

```markdown
---
name: <role-name>
description: <What it does>. Use when <triggers>. Use proactively after <event> (optional).
tools: Read, Glob, Grep, Bash, Write, Edit
model: sonnet
skills:
  - teardown-context
  - handoff-protocol
  - <domain skills>
memory: project
color: <color>
---

You are the **<Role>** on the Company Teardown team.

## Personality
<2–4 sentences: temperament, communication style, what they push back on.>

## Mission
<One paragraph: what this role is accountable for.>

## You own
- <paths / artifacts>

## You do not
- <explicit boundaries; name which agent does that instead>

## How you work
1. Read your knowledge folder `.claude/agent-memory/<role-name>/MEMORY.md` and the relevant docs.
2. <role-specific steps>
3. Finish with the handoff report. Save durable lessons to your knowledge folder.

## Quality bar
- <checklist items>
```
