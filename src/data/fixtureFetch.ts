/**
 * Fixture mode (TEARDOWN_FIXTURES=1, ADR 0001): a fetch that maps the exact SEC/FRED URLs the clients build
 * onto the real captured responses in fixtures/. Local preview and tests only; no network, no keys.
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { FetchLike } from "./http";

const json = (body: string, status = 200) =>
  new Response(body, { status, headers: { "content-type": "application/json" } });

export function createFixtureFetch(root = join(process.cwd(), "fixtures")): FetchLike {
  return async (input: string) => {
    const url = new URL(input);
    let file: string | null = null;
    if (url.origin === "https://www.sec.gov" && url.pathname === "/files/company_tickers.json") {
      file = "sec/company_tickers.json";
    } else if (url.origin === "https://data.sec.gov") {
      const m =
        /^\/submissions\/CIK(\d{10})\.json$/.exec(url.pathname) ??
        /^\/api\/xbrl\/companyfacts\/CIK(\d{10})\.json$/.exec(url.pathname);
      if (m) file = url.pathname.startsWith("/submissions") ? `sec/submissions-CIK${m[1]}.json` : `sec/companyfacts-CIK${m[1]}.json`;
    } else if (url.origin === "https://api.stlouisfed.org" && url.pathname === "/fred/series/observations") {
      const id = url.searchParams.get("series_id") ?? "";
      if (/^[A-Z0-9]{1,20}$/.test(id)) file = `fred/${id}-observations.json`;
    }
    if (!file) return json('{"error":"no fixture"}', 404);
    try {
      return json(await readFile(join(root, file), "utf8"));
    } catch {
      return json('{"error":"no fixture"}', 404);
    }
  };
}
