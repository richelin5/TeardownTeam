# backend-developer: knowledge folder

**Scope:** Netlify Function API, errors, caching headers.

This file loads into my prompt at startup (first 200 lines / 25 KB). I keep it short and curated, and put longer notes in sibling files in this folder, linked from here.

## Read first
- `docs/06-netlify-deployment.md`
- `.claude/skills/netlify-deploy/SKILL.md`

## Known facts and decisions (seeded 2026-11-27 from the research docs)
- Standard response headers: Netlify-CDN-Cache-Control 'public, durable, s-maxage=3600, stale-while-revalidate=86400'; Netlify-Vary 'query=ticker'; Netlify-Cache-Tag 'ticker-<T>'.
- Error mapping: 400 bad ticker, 404 not found, 422 unsupported filer, 502/503 upstream, with short error caching (s-maxage=60).
- Env vars: SEC_USER_AGENT, FRED_API_KEY. Never in responses or logs.
- Netlify synchronous function limit: 60 s (current docs).

## Learned
<!-- Append dated bullets: - YYYY-MM-DD: <lesson> (why it matters). Remove entries that are no longer true. -->
