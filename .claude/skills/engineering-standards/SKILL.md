---
name: engineering-standards
description: Coding conventions for Company Teardown (TypeScript strict, project structure, error handling, testing with fixtures from real filings, commits and branches). Use when writing or reviewing any code in the repository.
---

# Engineering standards

## Stack
- TypeScript (`strict: true`), Node 20+, ES modules. Netlify Functions (`.mts`) for the API.
- Front end: lightweight. Start with vanilla TS + Vite, or a framework only if an ADR approves it.
- Tests: Vitest for unit tests, Playwright for e2e and print checks (Chromium is pre-installed in cloud sessions: don't run `playwright install`).

## Structure
```
src/data/      EDGAR + FRED clients, resolver, tag chains, period logic (pure functions where possible)
src/api/       request handling, response shaping, caching headers
src/ui/        rendering, formatting (number formats, n.m., parentheses)
netlify/functions/teardown.mts   thin wrapper around src/api
fixtures/      trimmed real companyfacts/submissions JSON (with the accn and retrieval date in the filename)
tests/         unit/, tieout/, e2e/
```

## Rules
- Pure resolver functions: `(companyfacts, submissions) → Profile`. No network inside. This makes tie-out tests deterministic.
- Typed errors (`NotFoundError`, `UpstreamError`, `UnsupportedFilerError`) map to HTTP 404/502/422.
- No floating-point surprises: keep full units as numbers, and round only in formatting.
- Every bug fix adds a test that fails before and passes after.
- Fixtures come from real SEC responses, never hand-made numbers.
- Commits: small, imperative subject, with the *why* in the body. Never commit secrets or `.env`.
- Run `npm test`, `npm run typecheck` and `npm run lint` before reporting done, and paste the results in the handoff.
