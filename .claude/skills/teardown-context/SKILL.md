---
name: teardown-context
description: Company Teardown project context (what the product is, the non-negotiables, the research docs index and the glossary). Load before doing any work on Company Teardown.
user-invocable: false
---

# Company Teardown: project context

**Product:** the user types a US public company's ticker and gets a one-page, banker-style company profile built **only from free public data** (SEC EDGAR + FRED), **with a source on every number**.

## Non-negotiables (every agent enforces these)
1. **Every number has a source.** A value without `{tag, period, form, filed, accn, url}` (or a FRED series id and date) must not reach the UI. See the `source-citation` skill.
2. **Computed figures are labeled as computed**, with their formula (e.g. EBITDA = EBIT + D&A, "computed, unadjusted"). Never present a computed figure as company-reported.
3. **Free, official data only:** SEC EDGAR (`data.sec.gov`, `www.sec.gov`) and FRED (`api.stlouisfed.org`). Any other source (e.g. share price) is an explicit, labeled decision recorded in `docs/decisions/`.
4. **Upstream calls run server-side only.** `data.sec.gov` has no CORS and requires a declared `User-Agent`; the FRED key is secret.
5. **Respect fair access:** SEC allows at most 10 req/s total, FRED at most 120 req/min. Cache aggressively.
6. **One printable page.** The profile must fit landscape US Letter.

## Research docs (read the relevant one before acting)
| Doc | Read when |
|---|---|
| `docs/01-sec-edgar-apis.md` | touching anything that calls SEC |
| `docs/02-xbrl-tags.md` | mapping or changing a metric |
| `docs/03-xbrl-pitfalls.md` | choosing periods, LTM, Q4, restatements, fiscal years |
| `docs/04-fred-api.md` | rates and macro data |
| `docs/05-ib-one-pager.md` | layout, sections, definitions, formatting |
| `docs/06-netlify-deployment.md` | functions, caching, env vars, deploys |

## Target architecture (summary)
Static front end → `GET /api/teardown?ticker=XXX` (a Netlify Function) → SEC + FRED, with CDN + Blobs caching → a normalized profile JSON in which every metric carries its provenance.

## Glossary
- **CIK**: the SEC's company id, zero-padded to 10 digits in API URLs.
- **accn**: accession number, the id of one filing. It turns into the filing URL.
- **companyfacts**: the SEC endpoint with every XBRL fact for a company.
- **Tag / concept**: an XBRL element, e.g. `us-gaap:OperatingIncomeLoss`.
- **FY / Q / YTD / LTM / instant**: period classes. Classify by duration, never by `fp`.
- **n.m.**: not meaningful (e.g. P/E with negative earnings).
- **Tie-out**: checking a number on our page against the filing itself.

## Where things live
- Team definition: `CLAUDE.md`, `.claude/agents/`, `.claude/skills/`
- Agent knowledge folders: `.claude/agent-memory/<agent>/MEMORY.md`
- Decisions (ADRs): `docs/decisions/NNNN-title.md`
- Plan and status: `docs/project/STATUS.md` (owned by the orchestrator)
