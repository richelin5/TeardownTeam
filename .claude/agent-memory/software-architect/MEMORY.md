# software-architect: knowledge folder

**Scope:** System design, contracts and ADRs.

This file loads into my prompt at startup (first 200 lines / 25 KB). I keep it short and curated, and put longer notes in sibling files in this folder, linked from here.

## Read first
- `docs/01-sec-edgar-apis.md`
- `docs/06-netlify-deployment.md`
- `.claude/skills/source-citation/SKILL.md`

## Known facts and decisions (seeded 2026-11-27 from the research docs)
- Baseline architecture: static front end → Netlify Function /api/teardown → pure resolver → SEC/FRED clients, with CDN (durable + SWR) and Blobs caching.
- The browser never calls SEC (no CORS; UA required) or FRED (secret key).
- One companyfacts call per ticker, resolved locally.
- ADRs to write early: 0001 front-end stack, 0002 profile contract, 0003 share-price source, 0004 caching/Blobs schema.

## Learned
<!-- Append dated bullets: - YYYY-MM-DD: <lesson> (why it matters). Remove entries that are no longer true. -->
