/** Profile page: search → GET /api/teardown → render. Text-only DOM APIs; no metric math here. */
import type { ErrorBody, FilingRef, Metric, Profile } from "../contracts/profile";
import { revenueChart, marginChart, NARROW, WIDE } from "./charts";
import { clear, el } from "./dom";
import { describeSource, fiscalYearEndText, formatLong, formatValue, macroDateText, safeUrl, statusText } from "./format";
import { normalizeTickerUi } from "./ticker";
import "./styles.css";

/** n = footnote number (0 when the cell has no source and so gets no footnote); pl = print source letters. */
type Note = { id: number; n: number; rowLabel: string; colLabel: string; colIdx: number; derived: boolean; context: string; metric: Metric; pl: HTMLElement | null };

const app = document.getElementById("app")!;
const form = document.getElementById("search") as HTMLFormElement;
const input = document.getElementById("ticker") as HTMLInputElement;
const tip = document.getElementById("tip")!;
const status = document.getElementById("status")!;

const cells: Note[] = []; // every rendered number, for tooltips
const notes: Note[] = []; // only cells with >= 1 source, numbered 1..n
const byCellId = new Map<string, Note>();
let loadedTicker = "";

function link(url: string | undefined, text: string): HTMLElement {
  const safe = safeUrl(url);
  return safe ? el("a", { href: safe, rel: "noopener noreferrer", target: "_blank" }, text) : el("span", {}, text);
}

function register(rowLabel: string, colLabel: string, colIdx: number, metric: Metric, derived: boolean): Note {
  const note: Note = { id: cells.length + 1, n: 0, rowLabel, colLabel, colIdx, derived, context: colLabel ? `${rowLabel}, ${colLabel}` : rowLabel, metric, pl: null };
  cells.push(note);
  if (metric.sources.length > 0) {
    notes.push(note);
    note.n = notes.length;
  }
  byCellId.set(`m${note.id}`, note);
  return note;
}

/** A focusable number with a tooltip and (when it has a source) a footnote link into the sources panel. */
function numberCell(rowLabel: string, colLabel: string, colIdx: number, metric: Metric, derived = false): HTMLElement {
  const note = register(rowLabel, colLabel, colIdx, metric, derived);
  const missing = metric.status === "not-reported" || metric.status === "n.m.";
  const wrap = el(
    "span",
    { class: `num${missing ? " missing" : ""}`, tabindex: "0", "data-note": `m${note.id}`, "aria-describedby": "tip" },
    formatValue(metric),
  );
  if (metric.status === "computed") wrap.append(el("span", { class: "cmark", "aria-label": "computed" }, "c"));
  if (note.n) {
    wrap.append(el("a", { class: "fn", href: `#src-${note.n}`, tabindex: "-1", "aria-label": `source ${note.n}` }, String(note.n)));
    note.pl = el("span", { class: "pl", "aria-hidden": "true" });
    wrap.append(note.pl);
  }
  return wrap;
}

/** Text with any https://www.sec.gov/ URL turned into a safe link (text nodes only). */
function linkify(text: string): Node[] {
  const out: Node[] = [];
  let last = 0;
  for (const m of text.matchAll(/https:\/\/www\.sec\.gov\/[^\s)]*[^\s).,;]/g)) {
    out.push(document.createTextNode(text.slice(last, m.index)));
    out.push(link(m[0], m[0]));
    last = m.index! + m[0].length;
  }
  out.push(document.createTextNode(text.slice(last)));
  return out;
}

function tooltipContent(note: Note): Node[] {
  const m = note.metric;
  const missing = m.status === "not-reported" || m.status === "n.m.";
  const out: Node[] = [el("div", { class: "tip-title" }, note.context)];
  // Missing cells: one line, "status: note (with any SEC link)". Others: value and status.
  if (missing) out.push(el("div", {}, `${statusText(m)}${m.notes?.length ? ": " : ""}`, ...(m.notes ?? []).flatMap((n, i) => [i ? " " : "", ...linkify(n)])));
  else out.push(el("div", {}, `${formatLong(m)} · ${statusText(m)}`));
  if (m.formula) out.push(el("div", { class: "tip-formula" }, `Formula: ${m.formula}`));
  const list = el("ul", {});
  const unit = m.unit === "shares" ? "shares" : "USD";
  for (const s of m.sources) list.append(el("li", {}, missing ? link(s.url, describeSource(s, unit)) : describeSource(s, unit)));
  if (m.sources.length) out.push(list);
  if (!missing) for (const n of m.notes ?? []) out.push(el("div", { class: "tip-note" }, n));
  return out;
}

let activeTarget: HTMLElement | null = null;
function showTip(target: HTMLElement) {
  const note = byCellId.get(target.dataset.note ?? "");
  if (!note) return;
  activeTarget = target;
  clear(tip);
  tip.append(...tooltipContent(note));
  tip.hidden = false;
  const r = target.getBoundingClientRect();
  const tw = Math.min(380, window.innerWidth - 16);
  tip.style.maxWidth = `${tw}px`;
  const left = Math.max(8, Math.min(window.scrollX + r.left, window.scrollX + window.innerWidth - tw - 8));
  tip.style.left = `${left}px`;
  tip.style.top = `${window.scrollY + r.bottom + 6}px`;
}
const hideTip = () => {
  tip.hidden = true;
  activeTarget = null;
};

const numOf = (e: Event) => (e.target as HTMLElement).closest<HTMLElement>("[data-note]");

// Touch taps are followed by compatibility mouseover/focus events (often landing on the header); ignore them.
let lastTouch = -Infinity;
const afterTouch = () => performance.now() - lastTouch < 700;

document.addEventListener("mouseover", (e) => {
  const t = numOf(e);
  if (afterTouch()) return;
  if (t) showTip(t);
  else if (!(e.target as HTMLElement).closest("#tip")) hideTip();
});
document.addEventListener("focusin", (e) => {
  const t = numOf(e);
  if (afterTouch() && !t) return;
  if (t) showTip(t);
  else hideTip();
});
// Touch: a tap on a number shows its tooltip; a tap anywhere else dismisses it.
document.addEventListener("pointerup", (e) => {
  if (e.pointerType !== "touch") return;
  lastTouch = performance.now();
  const t = numOf(e);
  if (t) showTip(t);
  else if (!(e.target as HTMLElement).closest("#tip")) hideTip();
});
function openSources(hash?: string) {
  const details = document.getElementById("sources-details") as HTMLDetailsElement | null;
  if (details) details.open = true;
  if (hash) location.hash = hash;
}
// Footnote links open the collapsed sources panel.
document.addEventListener("click", (e) => {
  if ((e.target as HTMLElement).closest("a.fn")) openSources();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    hideTip();
    return;
  }
  const t = e.target as HTMLElement;
  if (!t.matches?.(".num[data-note]")) return;
  if (e.key === "Enter") {
    // Enter opens the source: expand the panel and jump to this number's entry.
    const note = byCellId.get(t.dataset.note ?? "");
    if (note && note.n) {
      e.preventDefault();
      openSources(`#src-${note.n}`);
    }
  } else if (e.key === " ") {
    e.preventDefault();
    if (!tip.hidden && activeTarget === t) hideTip();
    else showTip(t);
  }
});

function filingLine(label: string, f: FilingRef | null): HTMLElement {
  if (!f) return el("span", { class: "filing" }, `${label}: not reported`);
  return el("span", { class: "filing" }, `${label}: `, link(f.url, `${f.form} for period ${f.reportDate}, filed ${f.filed}`), ` (accn ${f.accn})`);
}

function macroItem(m: Metric): HTMLElement {
  const date = macroDateText(m.sources[0]);
  return el("div", { class: "macro-item" }, el("span", { class: "macro-label" }, m.label), " ", numberCell(m.label, "", -1, m), " ", el("span", { class: "muted" }, date));
}

function table(p: Profile): HTMLElement {
  const t = p.table;
  const thead = el("thead", {}, el("tr", {}, el("th", { scope: "col", class: "rowhead" }, "Fiscal year"),
    ...t.years.map((y) => el("th", { scope: "col" }, y.label, y.weeks53 ? el("span", { class: "sub" }, "53 wks") : null))));
  const tbody = el("tbody", {});
  for (const r of t.rows) {
    const cls = r.kind === "value" ? (r.id === "ebitda" ? "row-value row-key" : "row-value") : "row-sub";
    tbody.append(
      el("tr", { class: cls },
        el("th", { scope: "row", class: "rowhead" }, r.label),
        ...r.cells.map((c, i) => el("td", {}, numberCell(r.label, t.years[i]!.label, i, c, r.kind !== "value")))),
    );
  }
  return el("div", { class: "table-block" },
    el("p", { class: "table-caption muted", id: "table-caption" }, `Five fiscal years from 10-K XBRL data. ${p.units}.`),
    el("div", { class: "table-wrap", role: "region", "aria-label": "Five-year financials", "aria-describedby": "table-caption" },
      el("table", { class: "fin" }, thead, tbody)),
    el("p", { class: "swipe-hint muted", "aria-hidden": "true" }, "Swipe for more years \u2192"));
}

const shortYear = (label: string) => label.split(" ")[0] ?? label;

/** "FY22–FY25" for a run of 3+ consecutive columns, otherwise a comma list. */
function yearRanges(idx: number[], labels: string[]): string {
  const sorted = [...new Set(idx)].sort((a, b) => a - b);
  const parts: string[] = [];
  for (let i = 0; i < sorted.length; ) {
    let j = i;
    while (j + 1 < sorted.length && sorted[j + 1] === sorted[j]! + 1) j++;
    const a = shortYear(labels[sorted[i]!] ?? "");
    const b = shortYear(labels[sorted[j]!] ?? "");
    if (j - i >= 2) parts.push(`${a}\u2013${b}`);
    else for (let k = i; k <= j; k++) parts.push(shortYear(labels[sorted[k]!] ?? ""));
    i = j + 1;
  }
  return parts.join(", ");
}

type Group = { letter: string; head: string; url: string; rows: Map<string, number[]>; derivedRows: Map<string, number[]> };

/** Endnote wording drops the formula parenthetical: "EBITDA (computed: ...)" -> "EBITDA (computed)". */
const endnoteLabel = (l: string) => l.replace(/\(computed:[^)]*\)/, "(computed)");

/** Print only: one lettered endnote per filing (or FRED observation), listing the rows and years it supports. */
function endnotes(yearLabels: string[]): HTMLElement {
  const groups = new Map<string, Group>();
  for (const note of notes) {
    const letters: string[] = [];
    for (const s of note.metric.sources) {
      const key = s.kind === "sec" ? `sec:${s.accn}` : `fred:${s.seriesId}:${s.observationDate}`;
      let g = groups.get(key);
      if (!g) {
        const letter = letterFor(groups.size);
        const head = s.kind === "sec" ? `${s.form} filed ${s.filed}, accn ${s.accn}` : describeSource(s, "USD");
        g = { letter, head, url: s.url, rows: new Map(), derivedRows: new Map() };
        groups.set(key, g);
      }
      const target = note.derived ? g.derivedRows : g.rows;
      const label = endnoteLabel(note.rowLabel);
      const cols = target.get(label) ?? [];
      cols.push(note.colIdx);
      target.set(label, cols);
      if (!letters.includes(g.letter)) letters.push(g.letter);
    }
    if (note.pl) note.pl.textContent = letters.join(",");
  }
  const ul = el("ul", { class: "endnotes" });
  for (const g of groups.values()) {
    // Growth and margin rows are listed only when a filing supports nothing else (e.g. the prior-year base).
    const shown = g.rows.size ? g.rows : g.derivedRows;
    const what = [...shown].map(([row, idx]) => (idx[0] === -1 ? row : `${row} ${yearRanges(idx, yearLabels)}`)).join("; ");
    ul.append(el("li", {}, el("strong", {}, `[${g.letter}] `), `${g.head}, ${g.url}: ${what}`));
  }
  return el("div", { class: "endnotes-block" }, ul);
}

function letterFor(i: number): string {
  const A = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  return i < 26 ? A[i]! : `${A[Math.floor(i / 26) - 1]}${A[i % 26]}`;
}

function sourcesPanel(yearLabels: string[]): HTMLElement {
  const ol = el("ol", { class: "sources" });
  for (const note of notes) {
    const m = note.metric;
    const li = el("li", { id: `src-${note.n}` }, el("strong", {}, note.context), `: ${formatLong(m)} \u00b7 ${statusText(m)}`);
    if (m.formula) li.append(el("div", {}, `Formula: ${m.formula}`));
    const unit = m.unit === "shares" ? "shares" : "USD";
    for (const s of m.sources) li.append(el("div", { class: "src" }, link(s.url, describeSource(s, unit))));
    for (const n of m.notes ?? []) li.append(el("div", { class: "muted" }, n));
    ol.append(li);
  }
  const noSource = cells.length - notes.length;
  return el("section", { class: "panel", "aria-labelledby": "sources-h" },
    el("h2", { id: "sources-h" }, "Sources & notes"),
    el("p", { class: "muted screen-only" }, `Every sourced number on this page, with the filing (form, filing date, accession number) and XBRL tag it comes from, or its FRED series and date. c = computed from the listed inputs.${noSource ? " Cells shown as not reported or n.m. without a source have no entry here; hover them for the reason." : ""}`),
    el("details", { id: "sources-details", class: "screen-only" }, el("summary", {}, `Show all ${notes.length} sources`), ol),
    endnotes(yearLabels));
}

let currentTable: Profile["table"] | null = null;
const phone = window.matchMedia("(max-width: 600px)");
/** Phones get a narrower viewBox so chart text renders at >= 11 px. */
function drawCharts() {
  const host = document.getElementById("charts");
  if (!host || !currentTable) return;
  const size = phone.matches ? NARROW : WIDE;
  clear(host);
  host.append(el("figure", {}, revenueChart(currentTable, size)), el("figure", {}, marginChart(currentTable, size)));
}
phone.addEventListener("change", drawCharts);

function render(p: Profile) {
  notes.length = 0;
  cells.length = 0;
  byCellId.clear();
  loadedTicker = p.company.ticker;
  clear(app);
  const c = p.company;
  if (p.dataMode === "fixtures") {
    app.append(el("div", { class: "banner" }, "Fixture mode: data captured from SEC and FRED on 2026-11-27 (local preview, not live)."));
  }
  app.append(
    el("section", { class: "company" },
      el("h1", {}, `${c.name} (${c.ticker})`),
      el("p", { class: "facts" },
        el("span", {}, `CIK ${c.cik}`),
        el("span", {}, `Industry: SIC ${c.sic} · ${c.sicDescription}`),
        el("span", {}, `Fiscal year end: ${fiscalYearEndText(c.fiscalYearEnd, p.table.years[p.table.years.length - 1]?.end)}`),
        c.exchanges.length ? el("span", {}, c.exchanges.join(", ")) : null),
      el("p", { class: "filings" }, filingLine("Latest 10-K", p.filings.latest10K), filingLine("Latest 10-Q", p.filings.latest10Q))),
    el("section", { class: "macro", "aria-label": "Rates" }, macroItem(p.macro.dgs10), macroItem(p.macro.fedfunds), el("span", { class: "muted attribution" }, p.macro.attribution)),
  );
  if (p.warnings.length) app.append(el("ul", { class: "warnings" }, ...p.warnings.map((w) => el("li", {}, w))));
  app.append(
    table(p),
    el("p", { class: "legend muted" }, "c = computed \u00b7 hover, focus or tap any number for its source \u00b7 Enter opens the source"),
    el("section", { class: "charts", id: "charts" }),
    sourcesPanel(p.table.years.map((y) => y.label)),
  );
  currentTable = p.table;
  drawCharts();
  document.title = `${c.ticker}: ${c.name} | Company Teardown`;
}

function message(kind: "info" | "error", text: string, extra?: Node) {
  clear(app);
  app.append(el("div", { class: `msg ${kind}`, role: kind === "error" ? "alert" : "status" }, text, extra ?? ""));
}

function intro() {
  clear(app);
  const ex = el("p", {}, "Try: ");
  ["AAPL", "MSFT", "KO"].forEach((t, i) => {
    if (i) ex.append(" · ");
    ex.append(el("a", { href: `/?ticker=${t}` }, t));
  });
  app.append(el("section", { class: "intro" },
    el("h1", {}, "Company Teardown"),
    el("p", {}, "Type a US-listed ticker to see five fiscal years of core financials from the company's own 10-K XBRL data, with the source of every number. Rates come from FRED. No AI is used."),
    ex));
}

const BAD_TICKER = "That doesn't look like a ticker. Use 1\u201310 letters, digits or '-'.";

async function load(ticker: string) {
  status.textContent = `Loading ${ticker}\u2026`;
  message("info", `Loading ${ticker}\u2026`);
  try {
    const res = await fetch(`/api/teardown?ticker=${encodeURIComponent(ticker)}`, { headers: { Accept: "application/json" } });
    const body = (await res.json()) as Profile | ErrorBody;
    if (!res.ok || "error" in body) {
      const e = "error" in body ? body.error : { code: "internal", message: "Unexpected response." };
      const text =
        res.status === 400 ? BAD_TICKER
        : res.status === 404 ? e.message
        : res.status === 422 ? "This filer isn't supported in v1 (foreign/IFRS filer or no US GAAP data)."
        : "SEC or FRED didn't respond. Try again in a minute.";
      message("error", text);
      status.textContent = text;
      return;
    }
    render(body);
    status.textContent = `Loaded ${body.company.name}.`;
  } catch {
    message("error", "Couldn't reach the server. Check your connection and try again.");
    status.textContent = "Load failed.";
  }
}

/** Same normalization as the server, before fetch and before pushState. */
function lookup(raw: string, push: boolean) {
  const t = normalizeTickerUi(raw);
  if (!t) {
    message("error", BAD_TICKER);
    status.textContent = BAD_TICKER;
    return;
  }
  input.value = t;
  if (push) history.pushState(null, "", `/?ticker=${encodeURIComponent(t)}`);
  void load(t);
}

form.addEventListener("submit", (e) => {
  e.preventDefault();
  if (!input.value.trim()) return;
  lookup(input.value, true);
});

function fromUrl() {
  const t = new URLSearchParams(location.search).get("ticker");
  if (t) {
    // A hash-only change (footnote jumps) fires popstate too; don't reload the profile for it.
    if (loadedTicker && normalizeTickerUi(t) === loadedTicker && document.querySelector("table.fin")) return;
    lookup(t, false);
  } else intro();
}
window.addEventListener("popstate", fromUrl);
fromUrl();
