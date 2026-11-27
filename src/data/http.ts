/** Shared upstream HTTP helpers: injectable fetch, concurrency limiter, retry with backoff, TTL cache. */

export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

export type Sleep = (ms: number) => Promise<void>;
export const realSleep: Sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Simple FIFO concurrency limiter. It caps requests in flight per function instance only (module state is per
 * instance), so it does NOT enforce SEC's 10 req/s across instances; that relies on the CDN cache and the function's
 * per-IP rate limit.
 */
export function createLimiter(maxConcurrent: number) {
  let active = 0;
  const queue: (() => void)[] = [];
  const next = () => {
    if (active >= maxConcurrent) return;
    const run = queue.shift();
    if (run) {
      active++;
      run();
    }
  };
  return function limit<T>(task: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      queue.push(() => {
        task()
          .then(resolve, reject)
          .finally(() => {
            active--;
            next();
          });
      });
      next();
    });
  };
}

/** Retries 429/503 up to `tries` attempts total with exponential backoff and jitter. */
export async function fetchWithRetry(
  fetchImpl: FetchLike,
  url: string,
  init: RequestInit,
  opts: { tries?: number; sleep?: Sleep; baseMs?: number } = {},
): Promise<Response> {
  const tries = opts.tries ?? 3;
  const sleep = opts.sleep ?? realSleep;
  const baseMs = opts.baseMs ?? 300;
  let res: Response | undefined;
  for (let attempt = 1; attempt <= tries; attempt++) {
    res = await fetchImpl(url, init);
    if (res.status !== 429 && res.status !== 503) return res;
    if (attempt < tries) await sleep(baseMs * 2 ** (attempt - 1) + Math.floor(Math.random() * 100));
  }
  return res as Response;
}

/** Per-instance TTL cache (warm Netlify instances reuse module state). Bounded: oldest entry evicted first. */
export class TtlCache {
  private store = new Map<string, { expires: number; value: unknown }>();
  constructor(
    private now: () => number = Date.now,
    private maxEntries = 40,
  ) {}
  get<T>(key: string): T | undefined {
    const hit = this.store.get(key);
    if (!hit) return undefined;
    if (hit.expires < this.now()) {
      this.store.delete(key);
      return undefined;
    }
    return hit.value as T;
  }
  set(key: string, value: unknown, ttlMs: number): void {
    this.store.delete(key);
    while (this.store.size >= this.maxEntries) {
      const oldest = this.store.keys().next().value;
      if (oldest === undefined) break;
      this.store.delete(oldest);
    }
    this.store.set(key, { expires: this.now() + ttlMs, value });
  }
}

export const HOUR = 3_600_000;
