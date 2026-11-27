# devops-engineer: knowledge folder

**Scope:** Build, CI, deploys, environments, cache verification.

This file loads into my prompt at startup (first 200 lines / 25 KB). I keep it short and curated, and put longer notes in sibling files in this folder, linked from here.

## Read first
- `docs/06-netlify-deployment.md`
- `.claude/skills/netlify-deploy/SKILL.md`

## Known facts and decisions (seeded 2026-11-27 from the research docs)
- CI pipeline: install → typecheck → lint → tests (unit + tie-out) → npm audit --omit=dev → build.
- Env vars are set in Netlify by the user. The repo holds only .env.example placeholders.
- Verify caching via the Cache-Status header ('"Netlify Durable"; hit' on repeat requests).
- Production deploys need the user's go-ahead. Rollback = publish the previous deploy in Netlify.

## Learned
<!-- Append dated bullets: - YYYY-MM-DD: <lesson> (why it matters). Remove entries that are no longer true. -->
