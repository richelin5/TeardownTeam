// Rendered-page check of the MSFT D&A disclosure and debt label (Playwright, preinstalled). Usage: node render-check.mjs <baseUrl>
import { createRequire } from "node:module"; import { execSync } from "node:child_process";
const require = createRequire(import.meta.url); let pw; try { pw = require("playwright"); } catch { pw = require(`${execSync("npm root -g").toString().trim()}/playwright`); }
const base = process.argv[2]; const b = await pw.chromium.launch(); const out = {};
for (const t of ["AAPL", "MSFT", "KO"]) {
  const p = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  await p.goto(`${base}/?ticker=${t}`); await p.waitForSelector("table.fin");
  const text = await p.locator("body").innerText();
  const rows = await p.locator("table.fin tr").evaluateAll((trs) => trs.map((tr) => tr.innerText.replace(/\s+/g, " ").trim()));
  out[t] = { da: rows.find((r) => /^D&A/.test(r)), debt: rows.find((r) => /^Total debt/.test(r)), ebitda: rows.find((r) => /^EBITDA \(/.test(r)), disclosure: /does not tie to the cash-flow/i.test(text), snippet: (text.match(/[^\n]*does not tie to the cash-flow[^\n]*/i) ?? [""])[0].slice(0, 300) };
}
console.log(JSON.stringify(out, null, 1)); await b.close();
