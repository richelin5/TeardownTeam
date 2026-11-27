# Company Teardown: project status

Owner: orchestrator · Updated: 2026-11-27 · Milestone: v1 (AAPL, MSFT, KO end to end in fixture mode)

## Important process note
This session had **no Agent tool**, so the specialist agents could not be spawned. The orchestrator did each role's work itself, in wave order, following each role's skills. That breaks the team's separation of duties. **The review gates (finance-reviewer, security-reviewer, ux-designer, qa-tester sign-off) are NOT independently passed.** Below are the orchestrator's self-checks against each reviewer's checklist. They are evidence, not sign-offs. The next step is to run the real reviewer agents (see "Next").

## Done (built and self-verified)
| Area | Paths | Role whose work this is |
|---|---|---|
| PRD with testable ACs | `docs/product/v1-prd.md` | product-manager |
| Tag coverage (8 metrics × 3 cos × 5 FYs) | `docs/data/tag-coverage.md` | financial-data-engineer |
| Definitions ruling incl. MSFT D&A, KO/AAPL debt | `docs/finance/definitions-v1.md` | finance-reviewer (draft ruling, needs their confirmation) |
| ADR + API contract | `docs/decisions/0001-v1-stack-and-architecture.md`, `src/contracts/profile.ts` | software-architect |
| Design spec + screenshots | `docs/design/v1-profile-spec.md`, `docs/design/screenshots/` | ux-designer |
| Data layer | `src/data/` (sec, fred, http, periods, tagChains, resolver, profile, fixtureFetch, errors) | financial-data-engineer |
| Function + handler | `netlify/functions/teardown.mts`, `src/api/handler.ts` | backend-developer |
| UI + Resources page | `index.html`, `resources.html`, `src/ui/` | frontend-developer |
| Tooling, config, deploy guide | `package.json`, `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`, `netlify.toml`, `.gitignore`, `.env.example`, `README.md`, `scripts/` | devops-engineer |
| Tests + tie-out evidence | `tests/unit/`, `tests/tieout/` (`*-2026-11-27.md`, golden tests, `build-evidence.mjs`) | qa-tester |
| Fixture change | `fixtures/sec/companyfacts-CIK0000021344.json`: added `NotesAndLoansPayable`, copied verbatim from the raw gz | financial-data-engineer |

## Evidence (2026-11-27)
- `npm test`: 11 files, 63 tests passed. `npm run typecheck`: clean. `npm run build`: dist/ built, no inline scripts. `npm audit`: 0 vulnerabilities.
- Function in fixture mode: AAPL/MSFT/KO 200 with contract JSON and CDN headers; `ZZZZZZ` 404; `bad$$` 400; POST 405; SEC failure 502; FRED failure → 200 with that series not reported; missing env → 500 no-store.
- Tie-out (`node tests/tieout/build-evidence.mjs`): AAPL 75/75 PASS; MSFT 72 PASS + 3 EXPLAINED (D&A FY24–FY26 differ from the msft-extension CF line by design, per the definitions ruling); KO 75/75 PASS; header/macro 7/7 each. Negative control: a wrong label mapping produces 15 FAILs.
- Playwright (built dist/ under the netlify.toml CSP): 0 console/CSP errors; 390 px has no horizontal page scroll; the profile prints on 1 landscape Letter page for all three tickers.

## Orchestrator self-checks (NOT reviewer sign-offs)
| Gate | Self-check result | Independent sign-off |
|---|---|---|
| finance-reviewer | Labels, EBITDA formula, total-debt definition (no CP double count for KO), weighted diluted shares, growth/margin math and n.m., FY labels + 53-week flag, MSFT D&A computed-with-note: all consistent with `docs/finance/definitions-v1.md` | **pending** |
| qa-tester | 3 tie-out reports, 0 unexplained mismatches; golden tests encode them | **pending** (written by the same author as the resolver) |
| security-reviewer | No secrets in dist/, bodies, headers or logs (tests); strict ticker regex (tightened: `../etc` was accepted by the skill's regex); SSRF-safe URL building; textContent-only rendering + URL allowlist; CSP without inline; bounded in-memory cache (found unbounded, fixed); 0 audit vulns | **pending** |
| ux-designer | Round 1 issues found in screenshots and fixed: 390 px label column hid values; sources panel ~5,000 px (now collapsible, opens on footnote click/print); print sizing, legend and 2-page overflow fixed | **pending** |

## Open issues
- Reviewer gates above must be run by the actual agents.
- Netlify docs links for file-based configuration and environment variables on the Resources page could not be re-verified from this container (no web access). The other doc URLs come from the research docs.
- `netlify dev` was not tried (it needs network). Local verification used Vite plus `scripts/preview-fixtures.mjs`.
- Not deployed (no Netlify account). Live SEC/FRED calls are untested from here (egress blocked). They are covered only by URL/header unit tests.
- vitest 5.1.2 (dev-only) was published 2026-11-25. Re-audit at the next upgrade.
- The per-instance SEC limiter doesn't coordinate across function instances. The CDN cache is the shield.

## Version 2 backlog
1. Netlify Blobs cache for the ticker map/companyfacts (shared across instances), plus a scheduled warm-up function.
2. LTM column and latest-quarter data from the 10-Q (Q4 derivation per xbrl-mapping).
3. Share price source decision (ADR) → market cap, EV, EV/EBITDA, P/E, net debt.
4. Finance-lease memo line so total debt is comparable across issuers (KO includes them, AAPL/MSFT don't).
5. Cash & short-term investments row (marketable securities) next to cash.
6. Broader tie-out set: WMT (Jan FYE), JPM (bank: EBITDA n.m.), BRK-B (multi-class), O (REIT), a loss-maker, a 10-K/A restatement.
7. Bank/insurer/REIT sector metrics instead of n.m.
8. Playwright e2e suite in CI (`tests/e2e/`), GitHub Actions running test/typecheck/build/audit.
9. Sources panel grouped by fact (dedupe repeated inputs), CSV export of the table with sources.
10. Dark mode; ticker autocomplete from the SEC map; peer comparison via frames API.
11. Detect and decline 20-F/IFRS filers with a dedicated test fixture.

## Next
1. Run **finance-reviewer**, **security-reviewer**, **qa-tester** (independent re-tie-out) and **ux-designer** as real agents on this working tree. Route any findings to the owning role.
2. The user creates the Netlify site and sets `SEC_USER_AGENT` and `FRED_API_KEY` (README → "Deploy to Netlify (step by step)"), then runs a live smoke test against a deploy preview.
