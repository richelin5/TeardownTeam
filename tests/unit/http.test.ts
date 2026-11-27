import { describe, expect, it } from "vitest";
import { createLimiter, fetchWithRetry, TtlCache } from "../../src/data/http";

describe("fetchWithRetry", () => {
  it("retries 429/503 up to 3 tries then returns the last response", async () => {
    let n = 0;
    const res = await fetchWithRetry(async () => new Response("", { status: ++n < 3 ? 503 : 200 }), "https://x", {}, { sleep: async () => {} });
    expect(n).toBe(3);
    expect(res.status).toBe(200);
    let m = 0;
    const res2 = await fetchWithRetry(async () => { m++; return new Response("", { status: 429 }); }, "https://x", {}, { sleep: async () => {} });
    expect(m).toBe(3);
    expect(res2.status).toBe(429);
  });
  it("does not retry other errors", async () => {
    let n = 0;
    await fetchWithRetry(async () => { n++; return new Response("", { status: 500 }); }, "https://x", {}, { sleep: async () => {} });
    expect(n).toBe(1);
  });
});

describe("limiter and cache", () => {
  it("caps concurrency", async () => {
    const limit = createLimiter(2);
    let active = 0;
    let peak = 0;
    await Promise.all(Array.from({ length: 6 }, () => limit(async () => {
      active++; peak = Math.max(peak, active);
      await new Promise((r) => setTimeout(r, 5));
      active--;
    })));
    expect(peak).toBe(2);
  });
  it("is bounded (evicts the oldest entry)", () => {
    const c = new TtlCache(() => 0, 2);
    c.set("a", 1, 100); c.set("b", 2, 100); c.set("c", 3, 100);
    expect(c.get("a")).toBeUndefined();
    expect(c.get("b")).toBe(2);
    expect(c.get("c")).toBe(3);
  });
  it("expires entries", () => {
    let t = 0;
    const c = new TtlCache(() => t);
    c.set("k", 1, 10);
    expect(c.get("k")).toBe(1);
    t = 11;
    expect(c.get("k")).toBeUndefined();
  });
});
