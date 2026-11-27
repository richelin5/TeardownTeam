---
name: secure-serverless
description: Security baseline for Company Teardown's serverless app (secrets handling, input validation, SSRF prevention, output encoding/XSS, security headers, dependency hygiene, abuse and rate limiting, logging without secrets). Use when writing or reviewing functions, front-end rendering, config or dependencies.
---

# Security baseline

## Threat model (short)
Public, unauthenticated, read-only app. The assets worth protecting are the **FRED API key**, the **SEC contact identity and our IP reputation** (an SEC block takes the app down), the **integrity of the numbers** (wrong data presented as sourced), and **Netlify usage/costs**.

## Rules
1. **Secrets:** read only from `process.env` inside functions. Never send them to the client, log them, echo them in errors, or commit them. Keep `.env*` git-ignored. Scan the diff for 32-char hex strings and emails.
2. **Input validation:** the ticker matches `^[A-Z0-9-]{1,10}$` *after* normalization. Reject everything else with 400 before any upstream call.
3. **SSRF:** upstream URLs are built only from constants plus validated values (a CIK from the SEC map, a FRED id from a hard-coded allowlist). Never pass user input into a hostname or path segment unvalidated. There's no generic proxy endpoint.
4. **XSS:** render data with text APIs (`textContent`, framework escaping). No `innerHTML` with upstream strings: company names and filing text are untrusted. Source URLs must start with `https://www.sec.gov/` or `https://fred.stlouisfed.org/`.
5. **Headers** (`netlify.toml` `[[headers]]`): `Content-Security-Policy` (default-src 'self'; no inline scripts), `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` minimal, `frame-ancestors 'none'`.
6. **Abuse:** CDN caching absorbs repeated lookups. Invalid tickers get cheap 400s with short caching. Upstream concurrency is capped. Error caching is short.
7. **Errors:** return generic messages to the client, log details server-side without secrets or full upstream URLs containing the key.
8. **Dependencies:** minimal deps, a committed lockfile, `npm audit --omit=dev` in CI, no post-install scripts from unknown packages.
9. **Data integrity:** sanity checks in the resolver fail closed. Show "unavailable" rather than a wrong number.

## Review output
Findings are ranked **Critical / High / Medium / Low**, each with file:line, the exploit or failure scenario, and a concrete fix.
