/** SEC EDGAR client (edgar-api skill). Server-side only. Fetch is injected so tests run on fixtures. */
import { BadRequestError, NotFoundError, TickerNotFoundError, UnsupportedFilerError, UpstreamError } from "./errors";
import { createLimiter, fetchWithRetry, HOUR, isNetworkError, TtlCache, type FetchLike, type Sleep } from "./http";
import { isAnnualForm } from "./periods";
import { RESOLVER_TAGS } from "./tagChains";

export const SEC_TICKERS_URL = "https://www.sec.gov/files/company_tickers.json";
export const submissionsUrl = (cik10: string) => `https://data.sec.gov/submissions/CIK${cik10}.json`;
export const companyFactsUrl = (cik10: string) =>
  `https://data.sec.gov/api/xbrl/companyfacts/CIK${cik10}.json`;

export const TTL = {
  tickers: 24 * HOUR,
  submissions: 1 * HOUR,
  companyFacts: 6 * HOUR,
} as const;

/** Skill rule ^[A-Z0-9-]{1,10}$, tightened: no leading/trailing/double hyphens (security review). */
const TICKER_RE = /^(?=.{1,10}$)[A-Z0-9]+(?:-[A-Z0-9]+)*$/;
const CIK_RE = /^\d{10}$/;
/** SEC accession number, e.g. 0000320193-26-000026 (security L3). */
export const ACCN_RE = /^\d{10}-\d{2}-\d{6}$/;

/** Trim, upper-case, `.` and `/` → `-`, then validate. Throws BadRequestError. */
export function normalizeTicker(input: unknown): string {
  if (typeof input !== "string") throw new BadRequestError("Missing ticker");
  const t = input.trim().toUpperCase().replace(/[./]/g, "-");
  if (!TICKER_RE.test(t)) throw new BadRequestError("Invalid ticker");
  return t;
}

export const padCik = (cik: number | string) => String(cik).padStart(10, "0");

// ---- upstream shapes (only the fields we use) ----
export type Fact = {
  start?: string;
  end: string;
  val: number;
  accn: string;
  fy?: number | null;
  fp?: string | null;
  form: string;
  filed: string;
  frame?: string;
};
export type Concept = { label?: string; units: Record<string, Fact[]> };
export type CompanyFacts = {
  cik: number;
  entityName: string;
  facts: Record<string, Record<string, Concept> | undefined>;
};
export type RecentFilings = {
  accessionNumber: string[];
  filingDate: string[];
  reportDate: string[];
  form: string[];
  primaryDocument: string[];
};
export type Submissions = {
  cik: string;
  name: string;
  tickers: string[];
  exchanges: string[];
  sic: string;
  sicDescription: string;
  fiscalYearEnd: string;
  filings: { recent: RecentFilings };
};
export type TickerRow = { cik_str: number; ticker: string; title: string };

export type SecClientDeps = {
  fetch: FetchLike;
  userAgent: string;
  cache?: TtlCache;
  sleep?: Sleep;
};

/**
 * Per-instance limiter: at most 5 SEC requests in flight from THIS function instance. It is not a global cap:
 * each Lambda instance has its own module state, so concurrent instances are not coordinated. The global shield is
 * the CDN cache plus the per-IP rate limit on the function (see src/api/handler.ts). A cold profile build makes at
 * most 3 SEC calls.
 */
const limiter = createLimiter(5);

/**
 * Keeps only what the resolver reads: the us-gaap tags in RESOLVER_TAGS, units USD/shares, 10-K/10-K/A facts.
 * Applied before caching so a warm instance never holds full companyfacts (multi-MB per filer) in memory (L1).
 */
export function trimCompanyFacts(cf: CompanyFacts): CompanyFacts {
  const usgaap = cf.facts["us-gaap"] ?? {};
  const kept: Record<string, Concept> = {};
  for (const tag of RESOLVER_TAGS) {
    const c = usgaap[tag];
    if (!c) continue;
    const units: Record<string, Fact[]> = {};
    for (const u of ["USD", "shares"]) {
      const fs = c.units?.[u]?.filter((f) => isAnnualForm(f.form));
      if (fs?.length) units[u] = fs;
    }
    if (Object.keys(units).length) kept[tag] = { units };
  }
  return { cik: cf.cik, entityName: cf.entityName, facts: { "us-gaap": kept } };
}

export function createSecClient(deps: SecClientDeps) {
  const cache = deps.cache ?? new TtlCache();

  async function getJson<T>(url: string, ttl: number, prepare: (body: T) => T = (b) => b): Promise<T> {
    const cached = cache.get<T>(url);
    if (cached) return cached;
    let res: Response;
    try {
      res = await limiter(() =>
        fetchWithRetry(
          deps.fetch,
          url,
          {
            headers: { "User-Agent": deps.userAgent, "Accept-Encoding": "gzip, deflate", Accept: "application/json" },
            signal: AbortSignal.timeout(15_000),
          },
          { sleep: deps.sleep },
        ),
      );
    } catch (e) {
      if (!isNetworkError(e)) throw e;
      // Thrown fetch (DNS, reset, TLS) or AbortSignal timeout: an upstream failure, not an internal error (M1).
      throw new UpstreamError("sec", 0, "network/timeout");
    }
    if (res.status === 404) throw new NotFoundError("Not found at SEC");
    if (!res.ok) throw new UpstreamError("sec", res.status);
    let body: T;
    try {
      body = (await res.json()) as T;
    } catch {
      throw new UpstreamError("sec", res.status, "Malformed response from SEC");
    }
    const value = prepare(body);
    cache.set(url, value, ttl);
    return value;
  }

  return {
    async lookupTicker(ticker: string): Promise<{ cik10: string; title: string; otherTickers: string[] }> {
      const map = await getJson<Record<string, TickerRow>>(SEC_TICKERS_URL, TTL.tickers);
      const rows = Object.values(map);
      const hit = rows.find((r) => r.ticker.toUpperCase().replace(/[./]/g, "-") === ticker);
      if (!hit) throw new TickerNotFoundError(`No SEC registrant found for ticker ${ticker}`);
      const cik10 = padCik(hit.cik_str);
      if (!CIK_RE.test(cik10)) throw new UpstreamError("sec", 200, "Malformed ticker map");
      const otherTickers = rows
        .filter((r) => r.cik_str === hit.cik_str && r.ticker !== hit.ticker)
        .map((r) => r.ticker);
      return { cik10, title: hit.title, otherTickers };
    },
    getSubmissions(cik10: string) {
      if (!CIK_RE.test(cik10)) throw new BadRequestError("Invalid CIK");
      return getJson<Submissions>(submissionsUrl(cik10), TTL.submissions);
    },
    async getCompanyFacts(cik10: string) {
      if (!CIK_RE.test(cik10)) throw new BadRequestError("Invalid CIK");
      // Validation runs on the full body, then only the trimmed facts are cached and returned.
      return getJson<CompanyFacts>(companyFactsUrl(cik10), TTL.companyFacts, (cf) => {
        if (!cf?.facts?.["us-gaap"]) {
          throw new UnsupportedFilerError(
            cf?.facts?.["ifrs-full"] ? "IFRS filers are not supported in v1" : "No US GAAP financial data for this filer",
          );
        }
        return trimCompanyFacts(cf);
      });
    },
  };
}

export type SecClient = ReturnType<typeof createSecClient>;

/**
 * Filing URL: primary document if known, else the filing index (source-citation rule 6).
 * Fails closed: returns null (no URL) when the CIK or accession number is malformed (security L3).
 */
export function filingUrl(cik10: string, accn: string, primaryDocument?: string): string | null {
  if (!CIK_RE.test(cik10) || !ACCN_RE.test(accn)) return null;
  const cikNum = String(Number(cik10));
  const noDash = accn.replace(/-/g, "");
  return primaryDocument && /^[A-Za-z0-9._-]+$/.test(primaryDocument)
    ? `https://www.sec.gov/Archives/edgar/data/${cikNum}/${noDash}/${primaryDocument}`
    : `https://www.sec.gov/Archives/edgar/data/${cikNum}/${noDash}/${accn}-index.htm`;
}
