# Company Teardown: project status

Owner: orchestrator · Updated: 2026-11-27 · Milestone: **v1 complete** (all review gates passed; not yet deployed)

## How v1 was built
1. **Build:** the orchestrator ran the build. Its session couldn't spawn agents, so it did each role's work itself in wave order: PRD → ADR/contract + UX spec + tooling → data layer, function and UI → self-checks. It correctly refused to sign reviews off in the reviewers' names.
2. **Independent review:** the main session then ran the real registered reviewer agents (finance-reviewer, security-reviewer, qa-tester, ux-designer) in parallel.
3. **Fixes:** findings were routed to the owning agents, again in parallel and split by file ownership:
   - financial-data-engineer: `src/data`, fixtures, tests
   - backend-developer: `src/api`, the function
   - frontend-developer: `src/ui`
   - devops-engineer: README, CI, preview script
4. **Re-review:** each reviewer checked again until it approved.

## Review gates
| Gate | Rounds | Verdict | Evidence |
|---|---|---|---|
| finance-reviewer | 3 | **APPROVE** (round 3) | `docs/finance/definitions-v1.md` (approved header), reviewer notes in `.claude/agent-memory/finance-reviewer/` |
| qa-tester (independent tie-out) | 3 | **PASS** (round 3) | `tests/tieout/independent/REPORT-round2-2026-11-27.md` (incl. the round-3 section), `tieout.mjs`, `missing.test.ts` |
| security-reviewer | 2 | **APPROVE** (round 2) | Probes summarized in the round-2 report; reviewer notes in `.claude/agent-memory/security-reviewer/` |
| ux-designer | 3 | **APPROVE** (round 3) | `docs/design/review-2026-11-27/{,round2,round2-fix,round3}/` |

### Final evidence
- `npm test`: 14 files, 123 tests pass. `npm run typecheck`: clean. `npm run build`: passes. `npm audit`: 0 vulnerabilities.
- **Independent tie-out** against the actual 10-K statements and raw companyfacts:

| Company | FYE | Checks PASS | Checks FAIL |
|---|---|---|---|
| AAPL | Sep (52/53-week) | 94 | 0 |
| MSFT | Jun | 99 | 0 |
| KO | Dec | 94 | 0 |

  MSFT's D&A FY24–FY26 is counted as "PASS vs cited inputs; does NOT tie to CF line, disclosed on page" (see decisions).
- **Print:** fits on 1 landscape Letter page for AAPL, MSFT and KO.
- **Phone (390 px):** no horizontal scroll.
- **Touch and keyboard:** the source tooltip appears on tap and on focus, and Enter jumps to the source.
- **Browser:** 0 CSP or console errors.

## Key decisions (v1)
- **Stack:** Vite + vanilla TypeScript, inline-SVG charts, one Netlify Function (`/api/teardown`), Vitest, zero runtime dependencies (ADR 0001).
- **Total debt:** borrowings + finance lease liabilities, excluding operating leases, on the same basis for every company.
  - AAPL FY26: 81,567
  - MSFT FY26: 106,888
  - KO FY25: 45,492
- **MSFT D&A:** MSFT tags no us-gaap D&A total; its cash-flow line is the company extension `msft:DepreciationAmortizationAndOther`, which isn't in standard XBRL.
  - **Computed** as us-gaap `Depreciation` + `AmortizationOfIntangibleAssets`.
  - Labeled "D&A (computed: depreciation + amortization of intangibles)".
  - A note and a page warning say it does not tie to the cash-flow line: +466 / −1,433 / −958 for FY26 / FY25 / FY24.
- **"not reported" vs "n.m.":**
  - Missing data, or a ratio that needs missing data, shows "not reported".
  - "n.m." is only for meaningless ratios: prior value ≤ 0, revenue ≤ 0, non-consecutive years, financial-institution EBITDA.
- **Cash:** cash & cash equivalents only. A sourced note quantifies the excluded short-term investments.
- **Caching:**
  - CDN: `public, durable, s-maxage=3600, stale-while-revalidate=86400`.
  - Errors: 60 s. SEC rate-limit 502s: 300 s. Degraded macro: 300 s.
  - Non-canonical tickers get a 308 redirect to the canonical one.
  - In-memory caching per instance (trimmed companyfacts).
- **Upstream protection:** a per-IP Netlify rate limit of 30 requests per 60 s.
  - A site-wide global cap is Enterprise-only, so the residual risk is accepted for v1 and documented in `src/api/handler.ts`.
- **Fixture mode:** `TEARDOWN_FIXTURES=1` serves AAPL, MSFT and KO from real captured data, with no keys or network. Never set it on Netlify.

## Not verified here (environment limits)
- Live SEC and FRED calls: this container's egress blocks those hosts. They are covered by URL and header unit tests and by the real captured fixtures.
- An actual Netlify deploy: there's no account here. Rate-limit behaviour on a live site is also unchecked.
- Real-phone and WebKit touch tests: Playwright Chromium emulation only.

## Version 2 backlog
1. **Shared upstream protection:** a Netlify Blobs cache for the ticker map, trimmed companyfacts and FRED, plus a shared SEC token bucket or circuit breaker after a 403/429 (security L-b). Add a scheduled warm-up.
2. **LTM and latest-quarter columns** from the 10-Q (Q4 = FY − 9M per the xbrl-mapping skill).
3. **Share-price source ADR**, which unlocks market cap, EV, EV/EBITDA, P/E and net debt.
4. **Cash & short-term investments row** (the banker's canonical cash for net debt).
5. **MSFT-style extension D&A:** read the cash-flow D&A line from the filing's iXBRL (extension tag) so it ties, instead of computing it.
6. **Broader tie-out set:** WMT (Jan FYE), JPM (bank), BRK-B (multi-class), O (REIT), a loss-maker, a 10-K/A restater.
7. **Sector metrics** for banks, insurers and REITs instead of n.m.
8. **Playwright e2e and print tests in CI** (`tests/e2e/`). Pin GitHub Actions to SHAs and set `persist-credentials: false` (security L-c).
9. **Error-mapping cleanup:** stop logging resolver `TypeError`s as network failures (security L-a).
10. **Sourcing contract nits:**
    - n.m. cells (financial-institution EBITDA, sanity-failed revenue) should list their input sources (finance follow-up 1).
    - Linkify filing URLs everywhere through `safeUrl`.
11. **Print footer:** add "Retrieved <date>" and the product name (UX P3). Watch endnote length.
12. **UI extras:**
    - Ticker autocomplete from the SEC map.
    - Peer comparison via the frames API.
    - Sources panel deduplicated by fact.
    - CSV export with sources.
    - Dark mode.
13. **Decline 20-F/IFRS filers** gracefully, with a dedicated fixture.
14. **Preview server:** investigate the one crash seen after a Playwright `route.fetch` mock (UX P3).

## What the user must do to go live
See README → "Deploy to Netlify (step by step)":
1. Get a free FRED API key.
2. Import the repo in Netlify.
3. Set `SEC_USER_AGENT` and `FRED_API_KEY`:
   - Functions scope only.
   - Mark the FRED key as secret.
   - Require approval for fork-PR deploys.
4. Deploy, then run the README smoke checks against the live site.
