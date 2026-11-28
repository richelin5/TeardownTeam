// Generates public/og-image.png (exactly 1200x630, the Open Graph size LinkedIn uses) and
// docs/images/aapl-profile.png (README screenshot) from a REAL AAPL profile (captured SEC/FRED data).
// Requires the preview: npm run build && node scripts/preview-fixtures.mjs 4291
// Uses the pre-installed Playwright (never run `playwright install`).
import { createRequire } from "node:module";
import { execSync } from "node:child_process";
const require = createRequire(import.meta.url);
let pw;
try { pw = require("playwright"); } catch { pw = require(`${execSync("npm root -g").toString().trim()}/playwright`); }
const base = process.env.BASE_URL ?? "http://localhost:4291";
// The local preview runs in fixture mode and shows a "fixture mode" banner; hide it for the
// marketing images only. The numbers are the real AAPL 10-K figures either way.
const hideBanner = () => document.querySelectorAll(".banner").forEach((e) => e.remove());
const browser = await pw.chromium.launch();

const og = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
await og.goto(`${base}/?ticker=AAPL`);
await og.waitForSelector("table.fin");
await og.evaluate(hideBanner);
await og.screenshot({ path: "public/og-image.png", clip: { x: 0, y: 0, width: 1200, height: 630 } });

const shot = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });
await shot.goto(`${base}/?ticker=AAPL`);
await shot.waitForSelector("table.fin");
await shot.evaluate(hideBanner);
await shot.screenshot({ path: "docs/images/aapl-profile.png", fullPage: false });
await browser.close();
console.log("wrote public/og-image.png and docs/images/aapl-profile.png");
