import { createServer } from "vite";
// Usage: node scripts/dump-profile.mjs AAPL MSFT KO  (fixture mode; prints the resolved table)
const server = await createServer({ root: process.cwd(), server: { middlewareMode: true }, appType: "custom", logLevel: "error" });
const mod = await server.ssrLoadModule("/src/api/handler.ts");
for (const t of process.argv.slice(2)) {
  const res = await mod.handleRequest(new Request(`http://x/api/teardown?ticker=${t}`), mod.defaultDeps({ TEARDOWN_FIXTURES: "1" }));
  const body = await res.json();
  console.log("=====", t, res.status);
  if (res.status !== 200) { console.log(body, [...res.headers]); continue; }
  console.log(JSON.stringify(body.company), JSON.stringify(body.filings), body.macro.dgs10.value, body.macro.dgs10.sources[0]?.observationDate, body.macro.fedfunds.value, body.warnings);
  console.log("years", body.table.years.map((y)=>y.label+(y.weeks53?"*":"")).join(" | "));
  for (const r of body.table.rows) console.log(r.label.padEnd(44), r.cells.map((c)=> c.value===null? c.status : r.unit==="ratio"? (c.value*100).toFixed(1)+"%" : (c.value/1e6).toFixed(0) + (c.status==="computed"?"c":"")).join(" | "));
}
await server.close();
