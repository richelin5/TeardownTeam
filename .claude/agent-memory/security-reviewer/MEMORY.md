# security-reviewer: knowledge folder

**Scope:** Secrets, validation, SSRF/XSS, headers, dependencies.

This file loads into my prompt at startup (first 200 lines / 25 KB). I keep it short and curated, and put longer notes in sibling files in this folder, linked from here.

## Read first
- `.claude/skills/secure-serverless/SKILL.md`
- `docs/01-sec-edgar-apis.md`

## Known facts and decisions (seeded 2026-11-27 from the research docs)
- Assets: the FRED key, the SEC contact identity and IP reputation (a block takes the app down), number integrity, Netlify costs.
- Ticker regex after normalization: ^[A-Z0-9-]{1,10}$. Validate before any upstream call.
- Upstream URLs only from constants + validated values. No generic proxy endpoint.
- Required headers: CSP (no inline scripts), nosniff, Referrer-Policy, frame-ancestors 'none'.

## Learned
<!-- Append dated bullets: - YYYY-MM-DD: <lesson> (why it matters). Remove entries that are no longer true. -->
