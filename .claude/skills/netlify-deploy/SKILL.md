---
name: netlify-deploy
description: How Company Teardown is deployed and cached on Netlify (functions layout, config.path routing, Netlify-CDN-Cache-Control with durable and stale-while-revalidate, Netlify-Vary, cache tags and purge, Netlify Blobs, env vars, netlify dev, deploy previews). Use when touching netlify.toml, functions, caching headers, environment variables or CI/CD.
---

# Netlify deployment and caching

Full research: `docs/06-netlify-deployment.md`.

## Layout
```
netlify.toml              # [build] publish="public"; [functions] directory="netlify/functions"
netlify/functions/teardown.mts   # export default handler; export const config = { path: "/api/teardown" }
public/                   # static front end
```

## Caching standard (function responses)
```
Netlify-CDN-Cache-Control: public, durable, s-maxage=3600, stale-while-revalidate=86400
Cache-Control: public, max-age=0, must-revalidate
Netlify-Vary: query=ticker
Netlify-Cache-Tag: ticker-<TICKER>
```
- Function responses aren't cached unless these headers are set.
- `durable` shares the response across edge nodes. It's the main protection against the SEC/FRED rate limits.
- Query keys are case-sensitive, so normalize the ticker to upper case before building URLs.
- Purge one ticker with `purgeCache({ tags: ["ticker-AAPL"] })` from `@netlify/cache` (at most 2 purges per tag per 5 s). Every deploy also purges.
- **Never cache error responses** for long: send `Netlify-CDN-Cache-Control: public, s-maxage=60` on 4xx/5xx.
- Debug with the `Cache-Status` response header.

## Blobs (raw upstream cache)
`getStore("sec-cache")`, with TTL kept in metadata. Ticker map 24 h, submissions 1 h, companyfacts 6–24 h (trimmed to the tags we use), FRED 1–6 h.

## Environment variables
`SEC_USER_AGENT`, `FRED_API_KEY`. Set them in the Netlify UI or with `netlify env:set`. Never commit them. `.env` is git-ignored.

## Limits and ops
- The synchronous function limit is 60 s (per current Netlify docs; check your plan).
- Local: `netlify dev`. Deploys: Git-based. PRs get Deploy Previews, and `main` deploys to production.
- An optional scheduled function (`config.schedule = "@hourly"`) can warm FRED and the ticker map.
