// Independent tie-out (QA). Does NOT import tests/tieout/*. Reads the API dump (dump-api.mjs output),
// fixtures/filings/*.md (statements) and fixtures/sec/raw/*.json.gz (full companyfacts).
// Usage: node tests/tieout/independent/tieout.mjs <api-dump.json> <out-tables.md>
import fs from "fs"; import zlib from "zlib"; import path from "path";
const ROOT = path.resolve(import.meta.dirname, "../../..");
const dump = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const out = [];
const counts = {};
const fails = [];
function rec(t, metric, fy, page, filing, src, ok) {
  counts[t] ??= { pass: 0, fail: 0 }; ok ? counts[t].pass++ : (counts[t].fail++, fails.push(`${t} ${metric} ${fy}: page=${page} filing=${filing} (${src})`));
  out.push({ t, row: `| ${metric} | ${fy} | ${page} | ${filing} | ${src} | ${ok ? "PASS" : "**FAIL**"} |` });
}
const num = (s) => { s = s.replace(/[$\s]/g, ""); if (s === "") return NaN; const neg = /^\(.*\)$/.test(s); const v = Number(s.replace(/[(),]/g, "")); return neg ? -v : v; };
function parseMd(file) {
  const rows = []; let header = null;
  for (const l of fs.readFileSync(path.join(ROOT, "fixtures/filings", file), "utf8").split("\n")) {
    if (!l.startsWith("|")) continue;
    const c = l.split("|").slice(1, -1).map((x) => x.trim());
    if (/^-+$/.test(c[0])) continue;
    if (c.some((x) => /^[A-Z][a-z]{2}\. \d{1,2}, \d{4}$/.test(x))) { header = c.filter((x) => /\d{4}$/.test(x)); continue; }
    rows.push({ label: c[0].replace(/\*/g, ""), vals: c.slice(1).map(num) });
  }
  return { rows, header };
}
const MON = { Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6, Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12 };
const hdrIso = (h) => { const m = h.match(/^([A-Z][a-z]{2})\. (\d+), (\d{4})$/); return `${m[3]}-${String(MON[m[1]]).padStart(2, "0")}-${String(m[2]).padStart(2, "0")}`; };
function find(p, label, nth = 0) { const r = p.rows.filter((x) => x.label === label); if (!r[nth]) throw new Error(`no row ${label}#${nth}`); return r[nth].vals; }
const days = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5);

const CFG = {
  AAPL: { is: "AAPL-0000320193-26-000026-R3-income-statement.md", bs: "AAPL-0000320193-26-000026-R5-balance-sheet.md", cf: "AAPL-0000320193-26-000026-R8-cash-flow.md", cikf: "0000320193",
    rev: ["Net sales"], oi: ["Operating income"], ni: ["Net income"], sh: ["Diluted (in shares)"], shMult: 1e3, da: ["Depreciation and amortization"], cash: ["Cash and cash equivalents"],
    debt: [["Commercial paper", 0], ["Term debt", 0], ["Term debt", 1]], lastFY: 2026, revTags: ["RevenueFromContractWithCustomerExcludingAssessedTax", "Revenues", "SalesRevenueNet"], expAcc: "0000320193-26-000026" },
  MSFT: { is: "MSFT-0001193125-26-323660-R2-income-statement.md", bs: "MSFT-0001193125-26-323660-R4-balance-sheet.md", cf: "MSFT-0001193125-26-323660-R6-cash-flow.md", cikf: "0000789019",
    rev: ["Revenue"], oi: ["Operating income"], ni: ["Net income"], sh: ["Diluted", 1], shMult: 1e6, da: ["Depreciation, amortization, and other"], cash: ["Cash and cash equivalents"],
    debt: [["Current portion of long-term debt", 0], ["Long-term debt", 0]], revTags: ["RevenueFromContractWithCustomerExcludingAssessedTax", "Revenues", "SalesRevenueNet"], expAcc: "0001193125-26-323660" },
  KO: { is: "KO-0001628280-26-010047-R3-income-statement.md", bs: "KO-0001628280-26-010047-R5-balance-sheet.md", cf: "KO-0001628280-26-010047-R7-cash-flow.md", cikf: "0000021344",
    rev: ["Net Operating Revenues"], oi: ["Operating Income"], ni: ["Net Income Attributable to Shareowners of The Coca-Cola Company"], sh: ["Average Shares Outstanding — Diluted"], shMult: 1e6, da: ["Depreciation and amortization"], cash: ["Cash and cash equivalents"],
    debt: [["Loans and notes payable", 0], ["Current maturities of long-term debt", 0], ["Long-term debt", 0]], revTags: ["Revenues", "RevenueFromContractWithCustomerExcludingAssessedTax"], expAcc: "0001628280-26-010047" },
};
const fmtM = (v) => v == null ? "null" : (v / 1e6).toLocaleString("en-US", { maximumFractionDigits: 3 });
const rowOf = (b, id) => b.table.rows.find((r) => r.id === id);

for (const T of ["AAPL", "MSFT", "KO"]) {
  const cfg = CFG[T]; const res = dump[T]; const b = res.body;
  const raw = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(ROOT, `fixtures/sec/raw/companyfacts-CIK${cfg.cikf}.json.gz`))));
  const subs = JSON.parse(fs.readFileSync(path.join(ROOT, `fixtures/sec/submissions-CIK${cfg.cikf}.json`), "utf8"));
  const facts = (tax, tag) => Object.values(raw.facts[tax]?.[tag]?.units ?? {}).flat();
  const IS = parseMd(cfg.is), BS = parseMd(cfg.bs), CF = parseMd(cfg.cf);
  const years = b.table.years, N = years.length;
  const SRC = { is: "R-IS", bs: "R-BS", cf: "R-CF" };
  const filingUrl = (f) => `fixtures/filings/${f.split("-R")[0]}…${f.match(/-R\d+/)[0]}`;
  // header facts
  rec(T, "status 200", "-", res.status, 200, "handler", res.status === 200);
  rec(T, "name", "-", b.company.name, subs.name, "submissions.name", b.company.name === subs.name);
  rec(T, "ticker", "-", b.company.ticker, T, "request", b.company.ticker === T);
  rec(T, "SIC", "-", b.company.sic, subs.sic, "submissions.sic", b.company.sic === String(subs.sic));
  rec(T, "FYE", "-", b.company.fiscalYearEnd, subs.fiscalYearEnd, "submissions.fiscalYearEnd", b.company.fiscalYearEnd === subs.fiscalYearEnd);
  rec(T, "CIK", "-", b.company.cik, cfg.cikf, "fixtures/README", b.company.cik === cfg.cikf);
  const rc = subs.filings.recent; const accOf = (form) => { const i = rc.form.indexOf(form); return { i, accn: rc.accessionNumber[i], filed: rc.filingDate[i], rep: rc.reportDate[i], doc: rc.primaryDocument[i] }; };
  for (const [key, form] of [["latest10K", "10-K"], ["latest10Q", "10-Q"]]) {
    const f = accOf(form), p = b.filings[key]; const url = `https://www.sec.gov/Archives/edgar/data/${Number(cfg.cikf)}/${f.accn.replace(/-/g, "")}/${f.doc}`;
    rec(T, `${form} accn/filed/period/url`, "-", `${p.accn} ${p.filed} ${p.reportDate} ${p.url.split("/").pop()}`, `${f.accn} ${f.filed} ${f.rep} ${f.doc}`, "submissions.filings.recent (first of form)", p.accn === f.accn && p.filed === f.filed && p.reportDate === f.rep && p.url === url);
    if (key === "latest10K") rec(T, "latest 10-K accn == README", "-", p.accn, cfg.expAcc, "fixtures/README.md", p.accn === cfg.expAcc);
  }
  // macro
  const m = b.macro;
  rec(T, "DGS10 value/date", "-", `${m.dgs10.value} @ ${m.dgs10.sources[0].observationDate}`, "4.91 @ 2026-11-24", "fixtures/fred/DGS10-observations.json", m.dgs10.value === 4.91 && m.dgs10.sources[0].observationDate === "2026-11-24");
  rec(T, "FEDFUNDS value/date", "-", `${m.fedfunds.value} @ ${m.fedfunds.sources[0].observationDate}`, "3.88 @ 2026-10-01 (Oct-2026)", "fixtures/fred/FEDFUNDS-observations.json", m.fedfunds.value === 3.88 && m.fedfunds.sources[0].observationDate === "2026-10-01");

  // independent expected values (raw facts, 10-K only, latest filed per (start,end))
  const tenK = (arr) => arr.filter((f) => /^10-K/.test(f.form) && f.start && days(f.start, f.end) >= 350 && days(f.start, f.end) <= 380);
  const rawFY = (tags, end) => { for (const tg of tags) { const c = tenK(facts("us-gaap", tg)).filter((f) => f.end === end).sort((a, c2) => c2.filed.localeCompare(a.filed)); if (c.length) return { ...c[0], tag: tg }; } return null; };
  const rawInst = (tags, end) => { for (const tg of tags) { const c = facts("us-gaap", tg).filter((f) => /^10-K/.test(f.form) && !f.start && f.end === end).sort((a, c2) => c2.filed.localeCompare(a.filed)); if (c.length) return { ...c[0], tag: tg }; } return null; };

  const idx3 = [N - 1, N - 2, N - 3];
  const vals = { revenue: [], operating_income: [], net_income: [], da: [], cash: [], total_debt: [], diluted_shares: [] };
  const stmt = { revenue: [IS, cfg.rev], operating_income: [IS, cfg.oi], net_income: [IS, cfg.ni], da: [CF, cfg.da], diluted_shares: [IS, cfg.sh], cash: [BS, cfg.cash] };
  // header dates vs page years
  const isH = IS.header.map(hdrIso), bsH = BS.header.map(hdrIso);
  idx3.forEach((yi, k) => {
    const y = years[yi];
    rec(T, "period end (IS header)", y.label, y.end, isH[k], "R-IS column header", y.end === isH[k]);
    const dur = days(y.start, y.end);
    rec(T, "53-wk flag", y.label, `${dur}d weeks53=${y.weeks53}`, `${dur}d => ${dur > 367}`, "duration > 367d rule", y.weeks53 === dur > 367);
    if (k < 2) rec(T, "period end (BS header)", y.label, y.end, bsH[k], "R-BS column header", y.end === bsH[k]);
  });
  const metricLabel = { revenue: "Revenue", operating_income: "Operating income", net_income: "Net income", da: "D&A", cash: "Cash & cash equivalents", diluted_shares: "Diluted shares (M)", total_debt: "Total debt" };
  const filingVal = {};
  for (const id of ["revenue", "operating_income", "net_income", "da", "diluted_shares", "cash", "total_debt"]) {
    const r = rowOf(b, id);
    const ncol = id === "cash" || id === "total_debt" ? 2 : 3;
    for (let k = 0; k < ncol; k++) {
      const yi = idx3[k], c = r.cells[yi], lab = years[yi].label;
      let fv, src;
      if (id === "total_debt") { fv = cfg.debt.reduce((s, [l, n]) => s + find(BS, l, n)[k], 0) * 1e6; src = "R-BS: " + cfg.debt.map(([l]) => l).join(" + "); }
      else { const [P, lab2] = stmt[id]; fv = find(P, lab2[0], lab2[1] ?? 0)[k] * (id === "diluted_shares" ? cfg.shMult : 1e6); src = (P === IS ? "R-IS " : P === BS ? "R-BS " : "R-CF ") + `"${lab2[0]}"`; }
      filingVal[`${id}${yi}`] = fv;
      const unit = id === "diluted_shares" ? 1e6 : 1e6;
      rec(T, metricLabel[id], lab, fmtM(c.value) + (c.status === "computed" ? " (computed)" : ""), fmtM(fv), src, c.value === fv);
    }
  }
  // older years vs raw companyfacts
  const olderTags = { revenue: cfg.revTags, operating_income: ["OperatingIncomeLoss"], net_income: ["NetIncomeLoss"], da: ["DepreciationDepletionAndAmortization", "DepreciationAndAmortization", "DepreciationAmortizationAndAccretionNet"], diluted_shares: ["WeightedAverageNumberOfDilutedSharesOutstanding"] };
  for (let yi = 0; yi < N - 3; yi++) {
    const y = years[yi];
    for (const id of Object.keys(olderTags)) {
      const c = rowOf(b, id).cells[yi]; const f = rawFY(olderTags[id], y.end);
      if (!f) { rec(T, metricLabel[id], y.label, fmtM(c.value) + (c.status === "computed" ? " (computed, no raw tag)" : ""), "no 10-K fact for std tags in raw", "raw companyfacts", id === "da" && c.status === "computed"); continue; }
      rec(T, metricLabel[id], y.label, fmtM(c.value), fmtM(f.val), `raw ${f.tag} accn ${f.accn} ${f.form} filed ${f.filed}`, c.value === f.val);
    }
    const cs = rowOf(b, "cash").cells[yi]; const fc = rawInst(["CashAndCashEquivalentsAtCarryingValue"], y.end);
    rec(T, "Cash & cash equivalents", y.label, fmtM(cs.value), fc ? fmtM(fc.val) : "none", fc ? `raw ${fc.tag} accn ${fc.accn}` : "-", !!fc && cs.value === fc.val);
  }
  // sources: every SEC source of every cell must exist in raw with same accn/form/value/period, form 10-K*
  let nsrc = 0, bad = [];
  for (const r of b.table.rows) r.cells.forEach((c, yi) => {
    for (const s of c.sources) {
      if (s.kind !== "sec") { bad.push("non-sec src " + r.id); continue; } nsrc++;
      const hit = facts(s.taxonomy, s.tag).find((f) => f.accn === s.accn && f.end === s.periodEnd && (f.start ?? undefined) === s.periodStart && f.val === s.value);
      const okUrl = s.url.startsWith(`https://www.sec.gov/Archives/edgar/data/${Number(cfg.cikf)}/${s.accn.replace(/-/g, "")}/`);
      if (!hit) bad.push(`${r.id}/${years[yi].label}: ${s.tag} ${s.accn} ${s.periodEnd} ${s.value} not in raw`);
      else if (hit.form !== s.form || hit.filed !== s.filed) bad.push(`${r.id}/${years[yi].label}: form/filed ${s.form}/${s.filed} vs raw ${hit.form}/${hit.filed}`);
      else if (!/^10-K/.test(s.form)) bad.push(`${r.id}/${years[yi].label}: non-10-K source ${s.form}`);
      if (!okUrl) bad.push(`${r.id}/${years[yi].label}: url ${s.url}`);
    }
    if (c.status !== "not-reported" && c.sources.length === 0) bad.push(`${r.id}/${years[yi].label}: no sources`);
    if (c.status === "computed" && !c.formula) bad.push(`${r.id}/${years[yi].label}: computed w/o formula`);
  });
  rec(T, `citation check: ${nsrc} SEC sources vs raw (tag,accn,form,filed,period,value,url)`, "all", bad.length ? bad.length + " bad" : "0 bad", "0 bad", "raw companyfacts", bad.length === 0);
  bad.forEach((x) => out.push({ t: T, row: `| ^ detail | | ${x} | | | |` }));
  // latest 3 columns cite latest 10-K accn
  const latestOK = ["revenue", "operating_income", "net_income"].every((id) => idx3.every((yi) => rowOf(b, id).cells[yi].sources.every((s) => s.accn === cfg.expAcc)));
  rec(T, "IS rows for latest 3 FY cite latest 10-K accn", "FY-2..FY", latestOK ? "all" : "some other", cfg.expAcc, "fixtures/README", latestOK);

  // computed rows, recomputed from independent values (filing for 3 yrs; page inputs for older, whose inputs were checked above)
  const V = (id, yi) => { const c = rowOf(b, id).cells[yi]; return filingVal[`${id}${yi}`] ?? c.value; };
  const ebitda = (yi) => V("operating_income", yi) + V("da", yi);
  for (let yi = 0; yi < N; yi++) {
    const lab = years[yi].label, c = rowOf(b, "ebitda").cells[yi]; const e = ebitda(yi);
    rec(T, "EBITDA = OI + D&A", lab, fmtM(c.value), fmtM(e), "R-IS OI + R-CF D&A (older: page inputs)", c.value === e);
  }
  const pct1 = (x) => Math.round(x * 1000) / 10;
  const growthChecks = [["revenue_growth", "revenue"], ["operating_income_growth", "operating_income"], ["net_income_growth", "net_income"]];
  for (let yi = 0; yi < N; yi++) {
    const lab = years[yi].label;
    for (const [gid, base] of growthChecks) {
      const c = rowOf(b, gid).cells[yi];
      const cur = V(base, yi); const prior = yi > 0 ? V(base, yi - 1) : c.sources[1]?.value;
      const g = cur / prior - 1; rec(T, gid, lab, c.value == null ? c.status : pct1(c.value) + "%", pct1(g) + "% (" + fmtM(cur) + "/" + fmtM(prior) + "-1)", "recomputed", c.value != null && Math.abs(c.value - g) < 1e-12);
    }
    { const c = rowOf(b, "ebitda_growth").cells[yi]; const prior = yi > 0 ? ebitda(yi - 1) : null;
      if (prior == null) { const p0 = c.sources.filter((x) => x.periodEnd < years[yi].end).reduce((s, x) => s + x.value, 0); const g = ebitda(yi) / p0 - 1; rec(T, "ebitda_growth", lab, pct1(c.value) + "%", pct1(g) + "% (prior from cited src)", "recomputed", Math.abs(c.value - g) < 1e-12); }
      else { const g = ebitda(yi) / prior - 1; rec(T, "ebitda_growth", lab, pct1(c.value) + "%", pct1(g) + "%", "recomputed", Math.abs(c.value - g) < 1e-12); } }
    for (const [mid, num_] of [["operating_margin", V("operating_income", yi)], ["ebitda_margin", ebitda(yi)], ["net_margin", V("net_income", yi)]]) {
      const c = rowOf(b, mid).cells[yi]; const g = num_ / V("revenue", yi);
      rec(T, mid, lab, pct1(c.value) + "%", pct1(g) + "%", "recomputed", Math.abs(c.value - g) < 1e-12);
    }
  }
}
// not-reported rendering
const fmt = fs.readFileSync(path.join(ROOT, "src/ui/format.ts"), "utf8");
const nrCount = Object.values(dump).reduce((n, r) => n + (r.body.table?.rows ?? []).flatMap((x) => x.cells).filter((c) => c.status === "not-reported").length, 0);
out.push({ t: "_", row: `NOTE not-reported cells in the three profiles: ${nrCount}; format.ts mentions "not reported": ${/not reported/i.test(fmt)}` });
let md = "";
for (const T of ["AAPL", "MSFT", "KO"]) {
  md += `\n### ${T}  (pass ${counts[T].pass} / fail ${counts[T].fail})\n\n| Metric | FY | Page value ($M) | Filing value ($M) | Source | Result |\n|---|---|---|---|---|---|\n` + out.filter((o) => o.t === T).map((o) => o.row).join("\n") + "\n";
}
md += "\n" + out.filter((o) => o.t === "_").map((o) => o.row).join("\n") + "\n";
fs.writeFileSync(process.argv[3], md);
console.log(JSON.stringify(counts)); console.log(fails.join("\n"));
