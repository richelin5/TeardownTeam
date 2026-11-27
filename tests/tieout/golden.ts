import { expect } from "vitest";
import type { Row, SecSource } from "../../src/contracts/profile";
import { profile, row } from "../helpers";

export type Golden = {
  ticker: string;
  years: string[];
  /** $ millions (shares in millions), oldest first; values transcribed from the 10-K statements (tie-out reports). */
  values: Partial<Record<Row["id"], number[]>>;
  /** Expected accn per year for revenue (consistency: latest 10-K columns, older years their own 10-K). */
  revenueAccn: string[];
};

export async function checkGolden(g: Golden) {
  const p = await profile(g.ticker);
  expect(p.table.years.map((y) => y.label)).toEqual(g.years);
  for (const [id, vals] of Object.entries(g.values) as [Row["id"], number[]][]) {
    const got = row(p, id).cells.map((c) => (c.value === null ? null : Math.round((c.value / 1e6) * 1000) / 1000));
    expect(got, id).toEqual(vals);
  }
  expect(row(p, "revenue").cells.map((c) => (c.sources[0] as SecSource).accn)).toEqual(g.revenueAccn);
  return p;
}
