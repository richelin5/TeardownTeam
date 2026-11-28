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
- 2026-11-27: v1 review. A per-module limiter (sec.ts createLimiter(5)) and a module-level TtlCache are per Lambda instance. Lambda runs 1 request per instance, so they do not cap global SEC/FRED rates. Distinct tickers miss the CDN. Check for a global cap (Netlify `rateLimit` in the function config, plus Blobs) on every review (why: an SEC block takes the app down).
- 2026-11-27: fetch() throwing (network error, AbortSignal.timeout) is not a !res.ok path. Check that clients wrap it in UpstreamError, or it becomes a 500 with no-store and no CDN error caching (verified by probe: TypeError -> 500 no-store).
- 2026-11-27: Netlify-Vary query=ticker is keyed on the raw value. "aapl", " AAPL", "BRK.B" and "BRK-B" are separate CDN entries. Look for a canonical redirect.
- 2026-11-27: Public repo + env vars "for all deploy contexts" means fork PR Deploy Previews could exfiltrate FRED_API_KEY. Recommend marking it secret and setting the sensitive variable policy.
- 2026-11-27: Reusable probe: load src/api/handler.ts via vite ssrLoadModule with a fake fetch that records URLs. Import vite by absolute path from node_modules when the script lives in the scratchpad. Shows status, headers, logs and upstream call counts per input.
- 2026-11-27: Verified clean in v1 (re-check on change): the dist/ bundle has no env, key or UA; fixtures only via env TEARDOWN_FIXTURES==="1"; UI is text-only DOM + safeUrl allowlist; FRED errors/logs carry status only; lockfile is registry-only, with install scripts only in esbuild/fsevents.
- 2026-11-27 (round 2): APPROVED v1. Netlify code-based `rateLimit` is per-IP on non-Enterprise plans (domain-only aggregation is Enterprise), as verified by the coordinator against the docs. The global SEC cap is an accepted residual risk until there is a Blobs token bucket (v2). Re-check if the plan or traffic changes.
- 2026-11-27: The handler maps any TypeError to an upstream 502, so resolver crashes on malformed SEC shapes are logged as "network failure". Still fails closed, but the log misleads. Prefer data-layer-only mapping (isNetworkError in sec.ts/fred.ts).
- 2026-11-27: Probes for round 2 are probe2.mjs (handler matrix) and probe4.mjs (trim size, about 100 KB per filer vs 4-6 MB) in the session scratchpad. Notes containing URLs are rendered as text nodes, not links. If anyone linkifies them, they must go through safeUrl.
- 2026-11-28: Public-sharing review. Personal-data scans must cover git commit author/committer metadata (`git log --all --format='%an <%ae> | %cn <%ce>'`), not only file content. The initial commit 1e3beb5, created via the GitHub web UI, carries the user's personal email and is already on origin/main. Removing it needs a history rewrite + force push, which is the user's decision. Don't repeat the address in reports.
- 2026-11-28: Build-time HTML substitution (siteUrl plugin in vite.config.ts) was tested with `"><script>`, `javascript:`, `$&` and newline payloads. All fall back to "". Re-test if the regex changes. Rendered PDFs in docs/ embed http://localhost:4173 link URIs (harmless).
