# Company Teardown

Type a US-listed ticker and get a one-page company profile built only from free official data (SEC EDGAR and FRED), **with a source on every number**:

- Company facts: name, ticker, CIK, industry (SIC code and description), fiscal year end, links to the latest 10-K and 10-Q.
- Five fiscal years of revenue, operating income, net income, D&A, **EBITDA (computed: operating income + D&A)**, cash, total debt and diluted shares, with growth rates and margins, in a table and two charts.
- A macro strip with the 10-Year Treasury yield (FRED `DGS10`) and the fed funds rate (FRED `FEDFUNDS`), each with its observation date.
- Hover or focus any number for its form, filing date, accession number and XBRL tag. Every number is also listed in the sources panel. Missing values show "not reported", never a guess.
- No AI calls anywhere.

Stack (ADR [0001](docs/decisions/0001-v1-stack-and-architecture.md)): static HTML + vanilla TypeScript built with Vite, inline-SVG charts, one Netlify Function (`netlify/functions/teardown.mts`), Vitest. **Zero runtime dependencies.**

```
Browser ──GET /api/teardown?ticker=AAPL──► Netlify CDN (durable, 1 h + 24 h SWR)
                                              └─► Function: SEC submissions + companyfacts, FRED DGS10/FEDFUNDS
                                                   → resolver (src/data) → Profile JSON (src/contracts/profile.ts)
```

## Local development

Requires Node 20+ (22 recommended).

```bash
npm install
npm test            # unit, function and golden tie-out tests (offline, real fixtures)
npm run typecheck
npm run build       # → dist/
```

### Fixture mode (no network, no keys)
`TEARDOWN_FIXTURES=1` makes the function serve AAPL, MSFT and KO from the real SEC/FRED responses captured in `fixtures/` (2026-11-27).

```bash
npm run dev:fixtures                      # Vite dev server + /api/teardown in fixture mode → http://localhost:5173/?ticker=AAPL
# or a production-like preview of dist/ with the netlify.toml security headers:
npm run build && node scripts/preview-fixtures.mjs 4173
node scripts/screenshots.mjs              # desktop / 390 px / print screenshots → docs/design/screenshots/
node tests/tieout/build-evidence.mjs      # regenerate the tie-out reports in tests/tieout/
```

### Live mode locally
Copy `.env.example` to `.env`, fill in both variables, then run `npm run dev` (the Vite dev server reads `process.env`, so export them in your shell first) or `netlify dev` (reads `.env`).

## Deploy to Netlify (step by step)

1. **Get a FRED API key** (free): create an account at https://fredaccount.stlouisfed.org, then request a key at https://fred.stlouisfed.org/docs/api/api_key.html. It is a 32-character string. Keep it secret.
2. **Choose your SEC User-Agent.** The SEC requires every automated request to declare who you are: `"<App name> <contact email>"`, e.g. `CompanyTeardown you@yourdomain.com`. See https://www.sec.gov/search-filings/edgar-search-assistance/accessing-edgar-data.
3. **Push this repository to GitHub** (it already lives at https://github.com/richelin5/TeardownTeam).
4. **Create the site:** in Netlify, choose *Add new site → Import an existing project → GitHub*, then pick `richelin5/TeardownTeam`. Netlify reads `netlify.toml`, so leave the settings as detected:
   - Build command: `npm run build`
   - Publish directory: `dist`
   - Functions directory: `netlify/functions`
5. **Set the environment variables** before the first deploy: *Site configuration → Environment variables → Add a variable*. For each variable, set the scope to **Functions only** (not Builds or Runtime for the whole site), because only the function reads them:
   - `SEC_USER_AGENT` = `CompanyTeardown you@yourdomain.com`
   - `FRED_API_KEY` = your FRED key. Tick **Contains secret values** for this one. Netlify then hides the value after saving and scans build output and deploys for leaks of it.
   Or use the CLI: `netlify env:set SEC_USER_AGENT "CompanyTeardown you@yourdomain.com" --scope functions` and `netlify env:set FRED_API_KEY <key> --scope functions --secret`.
   Optionally remove `FRED_API_KEY` from the *Deploy Previews* and *Branch deploys* contexts (use a separate key or let previews run without it).
   **Never set `TEARDOWN_FIXTURES` on Netlify.**
   **Fork PRs (public repo):** in *Site configuration → Build & deploy → Environment variables → Sensitive variable policy*, choose **Require approval** (or **Deploy without sensitive variables**) so that a pull request from a fork cannot read your secret values in a Deploy Preview.
6. **Deploy:** click *Deploy site* (or push to `main`). Pull requests get Deploy Previews automatically.
7. **Verify:**
   - `https://<site>.netlify.app/?ticker=AAPL` renders the profile.
   - `curl -sI "https://<site>.netlify.app/api/teardown?ticker=AAPL"` shows `netlify-cdn-cache-control: public, durable, s-maxage=3600, stale-while-revalidate=86400`. Run it twice: the second response's `Cache-Status` header should show a hit.
   - `curl -s "https://<site>.netlify.app/api/teardown?ticker=ZZZZZZ"` returns 404 and `?ticker=bad$$` returns 400.
   - The response headers of `/` include `content-security-policy`.
   - A 500 "Server is not configured." means one of the two env vars is missing; set it and redeploy.
8. **Purge one ticker's cache** if needed: every deploy purges the CDN. Responses carry `Netlify-Cache-Tag: ticker-<TICKER>` for targeted purges.

## Caching and limits
- CDN: success `public, durable, s-maxage=3600, stale-while-revalidate=86400`, keyed by `Netlify-Vary: query=ticker`. Errors: `s-maxage=60`.
- Per warm function instance (bounded in-memory cache): ticker map 24 h, submissions 1 h, companyfacts 6 h, FRED 1 h.
- SEC: ≤ 5 concurrent requests per instance, with retries on 429/503 (3 tries, backoff). FRED: 2 requests per cache miss.

## Rate limiting and fair access
- The function applies a per-IP, code-based rate limit (added in `src/api/`), which limits a single client's cache-miss traffic.
- There is no global request cap on non-Enterprise Netlify plans, so this limit is not a hard ceiling.
- SEC allows at most 10 requests per second in total; FRED at most 120 per minute.
- The main protection is the CDN durable cache (1 h fresh, 24 h stale-while-revalidate): repeat lookups of a ticker never reach the function or the upstreams.

## Known limitations (v1)
See the v2 backlog and open issues in [docs/project/STATUS.md](docs/project/STATUS.md).

## Repository map
| Path | What |
|---|---|
| `src/contracts/profile.ts` | API contract shared by the function and the UI |
| `src/data/` | SEC + FRED clients (injectable fetch), tag chains, period logic, resolver, fixture fetch |
| `src/api/handler.ts`, `netlify/functions/teardown.mts` | validation, error mapping, cache headers |
| `src/ui/`, `index.html`, `resources.html` | page, formatting, SVG charts, tooltips, sources panel |
| `tests/` | unit tests, golden tie-out tests and tie-out reports (`tests/tieout/*-2026-11-27.md`) |
| `docs/` | research, PRD, design spec, ADRs, finance definitions, status |
| `fixtures/` | real captured SEC/FRED responses and 10-K statements |

The team that builds this repository is described in [CLAUDE.md](CLAUDE.md).
