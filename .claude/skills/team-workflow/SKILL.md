---
name: team-workflow
description: Company Teardown delivery workflow (phases, quality gates, review routing and the definition of done). Use when planning work, sequencing agents, or deciding who must review a change.
---

# Team workflow

## Phases
1. **Frame** (product-manager): problem, user story, acceptance criteria, out-of-scope list.
2. **Design** (ux-designer + software-architect, in parallel): wireframe/spec and technical design/ADR.
3. **Data** (financial-data-engineer): tag mapping, resolver changes, fixtures from real filings.
4. **Build** (backend-developer, then frontend-developer): API contract first, UI second.
5. **Verify** (qa-tester + finance-reviewer + security-reviewer, in parallel): tie-out, definitions, security.
6. **Ship** (devops-engineer): deploy preview, cache checks, production deploy.

Small changes may skip phases, but **gates are never skipped**.

## Quality gates (who must sign off)
| Change touches | Required sign-off |
|---|---|
| Any metric value, label, formula or period logic | finance-reviewer **and** qa-tester (tie-out) |
| XBRL tag chains / resolver | financial-data-engineer (author) + qa-tester + finance-reviewer |
| Serverless functions, env vars, headers, dependencies | security-reviewer |
| `netlify.toml`, caching headers, CI | devops-engineer + security-reviewer |
| Layout / print output | ux-designer |
| Architecture (new service, data store, external source) | software-architect, recorded as an ADR |
| Scope change | product-manager |

## Definition of done
- Acceptance criteria met, with evidence in the handoff report
- Tests added/updated and passing (`npm test`), types check, lint clean
- Every displayed number obeys the `source-citation` contract
- Required sign-offs collected (table above)
- `docs/project/STATUS.md` updated by the orchestrator

## File ownership (to avoid edit collisions)
| Path | Owner |
|---|---|
| `docs/product/` | product-manager |
| `docs/design/` | ux-designer |
| `docs/decisions/`, `docs/architecture/` | software-architect |
| `public/`, `src/ui/` | frontend-developer |
| `netlify/functions/`, `src/api/` | backend-developer |
| `src/data/` (EDGAR/FRED clients, resolver, tag chains), `fixtures/` | financial-data-engineer |
| `tests/tieout/`, `tests/e2e/` | qa-tester |
| `netlify.toml`, `.github/workflows/`, `package.json` scripts | devops-engineer |
| `.claude/` | agent-architect (agents and skills), orchestrator (STATUS) |

Two agents never edit the same file in parallel. The orchestrator sequences them.
