# Company Teardown: Agent Team

**Product:** type a US public company's ticker and get a one-page, banker-style profile built only from free public data (SEC EDGAR + FRED), **with a source on every number**. The research behind every rule here is in [`docs/`](docs/README.md).

This repository is built by a team of Claude Code subagents. This file explains who is on the team, how they work together, and how to extend the team.

## Non-negotiables (all agents)
1. **A source on every number.** Each value carries its XBRL tag, period, form, filed date, accession number and URL, or its FRED series and date (`source-citation` skill).
2. **Computed figures are labeled as computed** and show their formula (EBITDA, FCF, net debt, EV, margins, multiples, LTM, derived Q4).
3. **Free, official data only** (SEC + FRED). Any other source is an explicit ADR in `docs/decisions/`.
4. **Upstream calls run server-side only.** SEC: declared `User-Agent`, ≤ 10 req/s, no CORS. FRED: secret key, ≤ 120 req/min.
5. **Never guess a number.** If it's missing, show "unavailable" with a link to the filing.

## How to run the team

Run the orchestrator as the main session. That's the only mode in which its `Agent(...)` allowlist is enforced:

```bash
claude --agent orchestrator
```

Then describe the goal, e.g. "Build v1 for AAPL end to end." The orchestrator plans, delegates, enforces the review gates and reports back.

You can also call any specialist directly from a normal session: "Use the qa-tester to tie out MSFT", or `@agent-finance-reviewer review src/data/resolver.ts`. To add a role, ask the `agent-architect`, or run `/create-agent <role>`.

Validate the team definition after any change to `.claude/`:

```bash
python3 .claude/scripts/validate_team.py
```

## Roster

| Agent | Model | Why this model | Personality | Preloaded skills | Knowledge folder |
|---|---|---|---|---|---|
| `orchestrator` | opus (high effort) | Planning, sequencing and gatekeeping across 11 agents; errors compound | Calm chief of staff; says "not yet" without drama | teardown-context, team-workflow, handoff-protocol, source-citation | `.claude/agent-memory/orchestrator/` |
| `agent-architect` (meta) | opus (high) | Designing roles and tool scopes is judgment-heavy, and format errors fail silently | Librarian/staff engineer; fewer, sharper roles | teardown-context, create-agent, team-workflow, handoff-protocol | `.claude/agent-memory/agent-architect/` |
| `product-manager` | sonnet | Structured writing (PRDs, acceptance criteria) | User-obsessed, ruthless about scope | teardown-context, team-workflow, banker-metric-definitions, one-pager-layout, handoff-protocol | `.claude/agent-memory/product-manager/` |
| `ux-designer` | sonnet | Specs, layout and screenshot review | Print-first minimalist with pitch-book taste | teardown-context, one-pager-layout, banker-metric-definitions, source-citation, handoff-protocol | `.claude/agent-memory/ux-designer/` |
| `software-architect` | opus (high) | Long-lived decisions and contracts | Boring-tech pragmatist; writes down why | teardown-context, source-citation, edgar-api, fred-api, netlify-deploy, engineering-standards, handoff-protocol | `.claude/agent-memory/software-architect/` |
| `frontend-developer` | sonnet | Implementation from a clear spec | Pixel-precise craftsperson; never computes metrics | teardown-context, one-pager-layout, banker-metric-definitions, source-citation, secure-serverless, engineering-standards, handoff-protocol | `.claude/agent-memory/frontend-developer/` |
| `backend-developer` | sonnet | Implementation against a defined contract | Defensive and explicit; assumes every call fails | teardown-context, edgar-api, fred-api, netlify-deploy, secure-serverless, source-citation, engineering-standards, handoff-protocol | `.claude/agent-memory/backend-developer/` |
| `financial-data-engineer` | opus (high) | XBRL period and tag logic is subtle, and a wrong number is the worst failure | Pedantic about periods; never fills a gap with a guess | teardown-context, edgar-api, fred-api, xbrl-mapping, banker-metric-definitions, source-citation, engineering-standards, handoff-protocol | `.claude/agent-memory/financial-data-engineer/` |
| `finance-reviewer` | opus (high) | Final authority on banker definitions; needs domain judgment | Ex-bulge-bracket VP with a red pen; exacting but fair | teardown-context, banker-metric-definitions, source-citation, xbrl-mapping, one-pager-layout, filing-tieout, handoff-protocol | `.claude/agent-memory/finance-reviewer/` |
| `qa-tester` | sonnet | Methodical procedure plus test writing | Professional skeptic; nothing is right until it ties | teardown-context, filing-tieout, source-citation, banker-metric-definitions, xbrl-mapping, edgar-api, engineering-standards, handoff-protocol | `.claude/agent-memory/qa-tester/` |
| `security-reviewer` | opus (high) | Adversarial reasoning; missed findings are costly | Paranoid but practical; honest severity | teardown-context, secure-serverless, edgar-api, fred-api, netlify-deploy, handoff-protocol | `.claude/agent-memory/security-reviewer/` |
| `devops-engineer` | sonnet | Config, CI and verification work | Automate-everything, cache-obsessed, previews first | teardown-context, netlify-deploy, secure-serverless, engineering-standards, handoff-protocol | `.claude/agent-memory/devops-engineer/` |

**Model policy:** `opus` for judgment-heavy roles where a mistake is expensive (orchestration, architecture, financial correctness, security, team design). `sonnet` for implementation and structured production work. `haiku` is reserved for future high-volume mechanical agents (e.g. log or fixture triage). The agent-architect adds one when it's needed.

**Tool scoping:** reviewers (`finance-reviewer`, `security-reviewer`) get no Write/Edit tools. `memory: project` automatically lets them write only in their own knowledge folder. Only the orchestrator gets the `Agent` tool.

## Knowledge folders
Every agent has `memory: project`, which gives it a persistent folder at `.claude/agent-memory/<agent>/`, committed to git and shared with everyone who clones the repo. The first 200 lines (or 25 KB) of `MEMORY.md` load into the agent's prompt at startup. Each folder is seeded with the agent's scope, the docs to read first, and known facts from the research. Agents append dated lessons under "Learned". This requires Claude Code's auto memory to be on (the default).

## Skills (shared, in `.claude/skills/`)

| Skill | What it gives an agent | Used by |
|---|---|---|
| `teardown-context` | Product, non-negotiables, docs index, glossary | everyone |
| `handoff-protocol` | Standard task intake and the handoff report format | everyone |
| `team-workflow` | Phases, quality gates, definition of done, file ownership | orchestrator, agent-architect, product-manager |
| `source-citation` | The `Metric` provenance contract and its rules | most agents |
| `edgar-api` | SEC endpoints, User-Agent, rate limit, CORS, TTLs | architect, data eng, backend, QA, security |
| `fred-api` | FRED key, limits, series, missing values | architect, data eng, backend, security |
| `xbrl-mapping` (+ `tag-chains.md`) | Tag fallback chains, period classification, Q4/LTM, restatements | data eng, finance-reviewer, QA |
| `banker-metric-definitions` | Canonical IB definitions, labels, n.m. rules | PM, UX, frontend, data eng, finance-reviewer, QA |
| `one-pager-layout` | Page grid, formatting, states, print | PM, UX, frontend, finance-reviewer |
| `filing-tieout` | Tie-out procedure and standard ticker set (`/filing-tieout AAPL`) | QA, finance-reviewer |
| `netlify-deploy` | Functions, caching headers, Blobs, env vars | architect, backend, security, devops |
| `secure-serverless` | Secrets, validation, SSRF/XSS, headers, deps | frontend, backend, security, devops |
| `engineering-standards` | TS conventions, structure, testing, commits | architect, devs, data eng, QA, devops |
| `create-agent` (+ template) | Official agent and skill formats, registration steps (`/create-agent`) | agent-architect |

## Workflow and quality gates
Phases: **Frame** (PM) → **Design** (UX + architect) → **Data** (financial data engineer) → **Build** (backend → frontend) → **Verify** (QA + finance + security, in parallel) → **Ship** (DevOps).

| Change touches | Must be signed off by |
|---|---|
| Any metric value, label, formula or period logic | `finance-reviewer` **and** `qa-tester` |
| Tag chains / resolver | `financial-data-engineer` + `qa-tester` + `finance-reviewer` |
| Functions, env vars, headers, dependencies | `security-reviewer` |
| `netlify.toml`, caching, CI | `devops-engineer` + `security-reviewer` |
| Layout / print | `ux-designer` |
| Architecture or a new data source | `software-architect` (ADR) |
| Scope | `product-manager` |

Production deploys, pushes to `main`, and any paid or third-party data source need the user's approval.

## Repository map
```
CLAUDE.md                      this file
docs/                          research (01–06) + product/, design/, architecture/, decisions/, project/, qa/
.claude/agents/                12 agent definitions
.claude/skills/                14 shared skills
.claude/agent-memory/<agent>/  knowledge folders (MEMORY.md)
.claude/scripts/validate_team.py   team definition checks
src/ netlify/ public/ tests/ fixtures/   (created by the team; ownership is in the team-workflow skill)
```

## Conventions
- TypeScript strict. A pure resolver tested offline against real-filing fixtures. Vitest + Playwright.
- Secrets live only in Netlify env vars (`SEC_USER_AGENT`, `FRED_API_KEY`). The repo has `.env.example` placeholders only.
- Every agent ends its task with the handoff report and records durable lessons in its knowledge folder.
