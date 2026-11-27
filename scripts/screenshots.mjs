// Screenshots for UX review: desktop, 390 px and print (PDF + print-media PNG), plus console/CSP checks.
// Requires the preview running: node scripts/preview-fixtures.mjs 4173
// Uses the pre-installed Playwright (never run `playwright install`).
import { createRequire } from "node:module";
import { execSync } from "node:child_process";
import { mkdirSync } from "node:fs";

const require = createRequire(import.meta.url);
let pw;
try { pw = require("playwright"); } catch { pw = require(`${execSync("npm root -g").toString().trim()}/playwright`); }
const base = process.env.BASE_URL ?? "http://localhost:4173";
const out = process.env.OUT_DIR ?? "docs/design/screenshots";
mkdirSync(out, { recursive: true });

const browser = await pw.chromium.launch();
const problems = [];
async function page(viewport) {
  const ctx = await browser.newContext({ viewport });
  const p = await ctx.newPage();
  p.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") problems.push(`${m.type()}: ${m.text()}`); });
  p.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
  return p;
}

for (const t of ["AAPL", "MSFT", "KO"]) {
  const p = await page({ width: 1280, height: 900 });
  await p.goto(`${base}/?ticker=${t}`);
  await p.waitForSelector("table.fin");
  await p.screenshot({ path: `${out}/${t}-desktop.png`, fullPage: true });
  if (t === "MSFT") {
    const cell = p.locator("tr.row-value", { hasText: "D&A" }).first().locator(".num").last();
    await cell.hover();
    await p.waitForSelector("#tip:not([hidden])");
    await p.screenshot({ path: `${out}/MSFT-tooltip-da.png`, clip: { x: 0, y: 0, width: 1280, height: 900 } });
  }
  const scrollW = await p.evaluate(() => document.documentElement.scrollWidth);
  console.log(`${t} desktop ok; scrollWidth ${scrollW}; numbers ${await p.locator(".num").count()}; not reported ${await p.locator(".num.missing").count()}; svgs ${await p.locator("svg.chart").count()}`);
}

const m = await page({ width: 390, height: 844 });
await m.goto(`${base}/?ticker=AAPL`);
await m.waitForSelector("table.fin");
await m.screenshot({ path: `${out}/AAPL-390.png`, fullPage: true });
const mw = await m.evaluate(() => ({ doc: document.documentElement.scrollWidth, win: window.innerWidth }));
console.log(`390px: document scrollWidth ${mw.doc} vs viewport ${mw.win} → ${mw.doc <= mw.win ? "no horizontal page scroll" : "HORIZONTAL SCROLL"}`);

await m.emulateMedia({ media: "print" });
const pr = await page({ width: 1056, height: 816 });
await pr.goto(`${base}/?ticker=KO`);
await pr.waitForSelector("table.fin");
await pr.evaluate(() => window.dispatchEvent(new Event("beforeprint")));
await pr.emulateMedia({ media: "print" });
await pr.screenshot({ path: `${out}/KO-print-media.png`, fullPage: true });
await pr.pdf({ path: `${out}/KO-print.pdf`, format: "Letter", landscape: true, printBackground: true });

for (const [name, url] of [["notfound", "/?ticker=ZZZZZZ"], ["badticker", "/?ticker=A$$"], ["intro", "/"], ["resources", "/resources.html"]]) {
  const p = await page({ width: 1280, height: 800 });
  await p.goto(`${base}${url}`);
  await p.waitForTimeout(400);
  await p.screenshot({ path: `${out}/${name}.png`, fullPage: true });
  console.log(`${name}: ${(await p.locator("main").innerText()).slice(0, 90).replace(/\s+/g, " ")}`);
}
const filtered = problems.filter((x) => !/Failed to load resource: the server responded with a status of 40[04]/.test(x));
console.log(`console problems (excluding expected 400/404 API responses): ${filtered.length ? filtered.join(" | ") : "none"}`);
await browser.close();
