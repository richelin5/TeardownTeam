import { handleRequest, type HandlerDeps } from "../src/api/handler";
import type { Profile, Row } from "../src/contracts/profile";
import { createFixtureFetch } from "../src/data/fixtureFetch";
import { TtlCache, type FetchLike } from "../src/data/http";

export function fixtureDeps(overrides: Partial<HandlerDeps> = {}): HandlerDeps & { logs: string[] } {
  const logs: string[] = [];
  return {
    fetch: createFixtureFetch(),
    secUserAgent: "CompanyTeardown test@example.com",
    fredApiKey: "abcdef0123456789abcdef0123456789",
    dataMode: "fixtures",
    cache: new TtlCache(),
    log: (m) => logs.push(m),
    now: () => new Date("2026-11-27T12:00:00Z"),
    ...overrides,
    logs,
  };
}

export async function call(ticker: string | null, deps = fixtureDeps(), method = "GET") {
  const url = ticker === null ? "http://localhost/api/teardown" : `http://localhost/api/teardown?ticker=${encodeURIComponent(ticker)}`;
  const res = await handleRequest(new Request(url, { method }), deps);
  const text = await res.text();
  return { res, text, body: JSON.parse(text) as unknown };
}

export async function profile(ticker: string): Promise<Profile> {
  const { res, body } = await call(ticker);
  if (res.status !== 200) throw new Error(`status ${res.status}`);
  return body as Profile;
}

export function row(p: Profile, id: Row["id"]): Row {
  const r = p.table.rows.find((x) => x.id === id);
  if (!r) throw new Error(`missing row ${id}`);
  return r;
}

/** Wraps a fetch so specific URL predicates return a given status. */
export function failingFetch(base: FetchLike, pred: (url: string) => boolean, status: number): FetchLike {
  return async (url, init) => (pred(url) ? new Response("upstream says no", { status }) : base(url, init));
}
