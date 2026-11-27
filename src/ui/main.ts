/** Profile page: search → GET /api/teardown → render. Text-only DOM APIs; no metric math here. */
import type { ErrorBody, FilingRef, Metric, Profile } from "../contracts/profile";
import { revenueChart, marginChart } from "./charts";
import { clear, el } from "./dom";
import { describeSource, formatLong, formatValue, safeUrl, statusText } from "./format";
import "./styles.css";

type Note = { n: number; context: string; metric: Metric };

const app = document.getElementById("app")!;
const form = document.getElementById("search") as HTMLFormElement;
const input = document.getElementById("ticker") as HTMLInputElement;
const tip = document.getElementById("tip")!;
const status = document.getElementById("status")!;

const notes: Note[] = [];
const byCellId = new Map<string, Note>();

function link(url: string | undefined, text: string): HTMLElement {
  const safe = safeUrl(url);
  return safe ? el("a", { href: safe, rel: "noopener noreferrer", target: "_blank" }, text) : el("span", {}, text);
}

function register(context: string, metric: Metric): Note {
  const note = { n: notes.length + 1, context, metric };
  notes.push(note);
  byCellId.set(`m${note.n}`, note);
  return note;
}

/** A focusable number with a tooltip and a footnote link into the sources panel. */
function numberCell(context: string, metric: Metric): HTMLElement {
  const note = register(context, metric);
  const missing = metric.status === "not-reported" || metric.status === "n.m.";
  const wrap = el(
    "span",
    { class: `num${missing ? " missing" : ""}`, tabindex: "0", "data-note": `m${note.n}`, "aria-describedby": "tip" },
    formatValue(metric),
  );
  if (metric.status === "computed") wrap.append(el("span", { class: "cmark", "aria-label": "computed" }, "c"));
  wrap.append(el("a", { class: "fn", href: `#src-${note.n}`, tabindex: "-1", "aria-label": `source ${note.n}` }, String(note.n)));
  return wrap;
}

function tooltipContent(note: Note): Node[] {
  const m = note.metric;
  const out: Node[] = [
    el("div", { class: "tip-title" }, note.context),
    el("div", {}, `${formatLong(m)} · ${statusText(m)}`),
  ];
  if (m.formula) out.push(el("div", { class: "tip-formula" }, `Formula: ${m.formula}`));
  const list = el("ul", {});
  const unit = m.unit === "shares" ? "shares" : "USD";
  for (const s of m.sources) list.append(el("li", {}, describeSource(s, unit)));
  if (m.sources.length) out.push(list);
  for (const n of m.notes ?? []) out.push(el("div", { class: "tip-note" }, n));
  return out;
}

function showTip(target: HTMLElement) {
  const note = byCellId.get(target.dataset.note ?? "");
  if (!note) return;
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
};

document.addEventListener("mouseover", (e) => {
  const t = (e.target as HTMLElement).closest<HTMLElement>("[data-note]");
  if (t) showTip(t);
  else if (!(e.target as HTMLElement).closest("#tip")) hideTip();
});
document.addEventListener("focusin", (e) => {
  const t = (e.target as HTMLElement).closest<HTMLElement>("[data-note]");
  if (t) showTip(t);
  else hideTip();
});
// Footnote links and printing open the collapsed sources panel.
document.addEventListener("click", (e) => {
  const a = (e.target as HTMLElement).closest<HTMLAnchorElement>("a.fn");
  const details = document.getElementById("sources-details") as HTMLDetailsElement | null;
  if (a && details) details.open = true;
});
const openForPrint = () => {
  const details = document.getElementById("sources-details") as HTMLDetailsElement | null;
  if (details) details.open = true;
};
window.addEventListener("beforeprint", openForPrint);
window.matchMedia("print").addEventListener("change", (e) => {
  if (e.matches) openForPrint();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") hideTip();
});

function filingLine(label: string, f: FilingRef | null): HTMLElement {
  if (!f) return el("span", { class: "filing" }, `${label}: not reported`);
  return el("span", { class: "filing" }, `${label}: `, link(f.url, `${f.form} for period ${f.reportDate}, filed ${f.filed}`), ` (accn ${f.accn})`);
}

function fye(mmdd: string): string {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const m = months[Number(mmdd.slice(0, 2)) - 1];
  return m ? `${m} ${Number(mmdd.slice(2))} (SEC: ${mmdd})` : mmdd;
}

function macroItem(m: Metric): HTMLElement {
  const src = m.sources[0];
  const date = src && src.kind === "fred" ? `as of ${src.observationDate}` : "";
  return el("div", { class: "macro-item" }, el("span", { class: "macro-label" }, m.label), " ", numberCell(m.label, m), " ", el("span", { class: "muted" }, date));
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
        ...r.cells.map((c, i) => el("td", {}, numberCell(`${r.label}, ${t.years[i]!.label}`, c)))),
    );
  }
  return el("div", { class: "table-wrap", tabindex: "0", role: "region", "aria-label": "Five-year financials" },
    el("table", { class: "fin" }, el("caption", {}, `Five fiscal years from 10-K XBRL data. ${p.units}.`), thead, tbody));
}

function sourcesPanel(): HTMLElement {
  const ol = el("ol", { class: "sources" });
  for (const note of notes) {
    const m = note.metric;
    const li = el("li", { id: `src-${note.n}` }, el("strong", {}, note.context), `: ${formatLong(m)} · ${statusText(m)}`);
    if (m.formula) li.append(el("div", {}, `Formula: ${m.formula}`));
    const unit = m.unit === "shares" ? "shares" : "USD";
    for (const s of m.sources) li.append(el("div", { class: "src" }, link(s.url, describeSource(s, unit)), el("span", { class: "print-url" }, ` ${s.url}`)));
    for (const n of m.notes ?? []) li.append(el("div", { class: "muted" }, n));
    ol.append(li);
  }
  return el("section", { class: "panel", "aria-labelledby": "sources-h" },
    el("h2", { id: "sources-h" }, "Sources & notes"),
    el("p", { class: "muted" }, "Every number on this page, with the filing (form, filing date, accession number) and XBRL tag it comes from, or its FRED series and date. c = computed from the listed inputs."),
    el("details", { id: "sources-details" }, el("summary", {}, `Show all ${notes.length} sources`), ol));
}

function render(p: Profile) {
  notes.length = 0;
  byCellId.clear();
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
        el("span", {}, `Fiscal year end: ${fye(c.fiscalYearEnd)}`),
        c.exchanges.length ? el("span", {}, c.exchanges.join(", ")) : null),
      el("p", { class: "filings" }, filingLine("Latest 10-K", p.filings.latest10K), filingLine("Latest 10-Q", p.filings.latest10Q))),
    el("section", { class: "macro", "aria-label": "Rates" }, macroItem(p.macro.dgs10), macroItem(p.macro.fedfunds), el("span", { class: "muted attribution" }, p.macro.attribution)),
  );
  if (p.warnings.length) app.append(el("ul", { class: "warnings" }, ...p.warnings.map((w) => el("li", {}, w))));
  app.append(
    table(p),
    el("p", { class: "legend muted" }, "c = computed · hover or focus any number for its source · numbers link to the sources panel"),
    el("section", { class: "charts" }, el("figure", {}, revenueChart(p.table)), el("figure", {}, marginChart(p.table))),
    sourcesPanel(),
  );
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

async function load(ticker: string) {
  status.textContent = `Loading ${ticker}…`;
  message("info", `Loading ${ticker}…`);
  try {
    const res = await fetch(`/api/teardown?ticker=${encodeURIComponent(ticker)}`, { headers: { Accept: "application/json" } });
    const body = (await res.json()) as Profile | ErrorBody;
    if (!res.ok || "error" in body) {
      const e = "error" in body ? body.error : { code: "internal", message: "Unexpected response." };
      const text =
        res.status === 400 ? "That doesn't look like a ticker. Use 1–10 letters, digits or '-'."
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

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const t = input.value.trim().toUpperCase();
  if (!t) return;
  history.pushState(null, "", `/?ticker=${encodeURIComponent(t)}`);
  void load(t);
});

function fromUrl() {
  const t = new URLSearchParams(location.search).get("ticker");
  if (t) {
    input.value = t.toUpperCase();
    void load(t.toUpperCase());
  } else intro();
}
window.addEventListener("popstate", fromUrl);
fromUrl();

