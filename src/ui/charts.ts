/** Dependency-free inline SVG charts (ADR 0001, design spec). Values come precomputed from the API. */
import type { FinancialTable, Row } from "../contracts/profile";
import { svg } from "./dom";
import { formatValue } from "./format";

/** Wide layout (desktop/print) and a narrow one for phones, drawn ~1:1 so SVG text stays >= 11 px rendered. */
export type ChartSize = { W: number; H: number; narrow: boolean };
export const WIDE: ChartSize = { W: 520, H: 260, narrow: false };
export const NARROW: ChartSize = { W: 330, H: 250, narrow: true };
const PAD = { l: 52, r: 12, t: 28, b: 36 };

function row(table: FinancialTable, id: Row["id"]): Row | undefined {
  return table.rows.find((r) => r.id === id);
}

function shortLabel(label: string): string {
  return label.split(" ")[0] ?? label; // "FY26"
}

export function revenueChart(table: FinancialTable, size: ChartSize = WIDE): SVGSVGElement {
  const { W, H } = size;
  const rev = row(table, "revenue");
  const values = rev?.cells.map((c) => c.value) ?? [];
  const max = Math.max(1, ...values.map((v) => (v !== null && v > 0 ? v : 0)));
  const n = table.years.length || 1;
  const plotW = W - PAD.l - PAD.r;
  const plotH = H - PAD.t - PAD.b;
  const slot = plotW / n;
  const barW = Math.min(64, slot * 0.6);
  const summary = table.years.map((y, i) => `${y.label}: ${rev ? formatValue(rev.cells[i]!) : "not reported"}`).join("; ");
  const root = svg("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": `Revenue by fiscal year, $ in millions. ${summary}`, class: "chart" });
  root.append(svg("text", { x: PAD.l, y: 16, class: "chart-title" }, "Revenue ($M)"));
  root.append(svg("line", { x1: PAD.l, x2: W - PAD.r, y1: PAD.t + plotH, y2: PAD.t + plotH, class: "axis" }));
  table.years.forEach((y, i) => {
    const cx = PAD.l + slot * i + slot / 2;
    const cell = rev?.cells[i];
    const v = cell?.value ?? null;
    if (v !== null && v > 0 && cell) {
      const h = (v / max) * plotH;
      const bar = svg("rect", { x: cx - barW / 2, y: PAD.t + plotH - h, width: barW, height: h, class: "bar" });
      bar.append(svg("title", {}, `${y.label} revenue: $${formatValue(cell)}M`));
      root.append(bar);
      root.append(svg("text", { x: cx, y: PAD.t + plotH - h - 5, class: "bar-label", "text-anchor": "middle" }, formatValue(cell)));
    } else {
      root.append(svg("text", { x: cx, y: PAD.t + plotH - 6, class: "bar-label muted", "text-anchor": "middle" }, "n/r"));
    }
    root.append(svg("text", { x: cx, y: H - 14, class: "tick", "text-anchor": "middle" }, shortLabel(y.label)));
  });
  return root;
}

const SERIES: { id: Row["id"]; name: string; cls: string }[] = [
  { id: "operating_margin", name: "Operating margin", cls: "line-op" },
  { id: "ebitda_margin", name: "EBITDA margin", cls: "line-ebitda" },
  { id: "net_margin", name: "Net margin", cls: "line-net" },
];

export function marginChart(table: FinancialTable, size: ChartSize = WIDE): SVGSVGElement {
  const { W, H } = size;
  const all = SERIES.flatMap((s) => row(table, s.id)?.cells.map((c) => c.value) ?? []).filter((v): v is number => v !== null);
  const hi = Math.max(0.1, ...all);
  const lo = Math.min(0, ...all);
  const top = Math.ceil(hi * 10) / 10;
  const bottom = Math.floor(lo * 10) / 10;
  const n = table.years.length || 1;
  const plotW = W - PAD.l - PAD.r;
  const plotH = H - PAD.t - PAD.b;
  const x = (i: number) => PAD.l + (plotW / n) * i + plotW / n / 2;
  const y = (v: number) => PAD.t + ((top - v) / (top - bottom || 1)) * plotH;
  const summary = SERIES.map((s) => `${s.name}: ${(row(table, s.id)?.cells ?? []).map(formatValue).join(", ")}`).join("; ");
  const root = svg("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": `Margins by fiscal year. ${summary}`, class: "chart" });
  root.append(svg("text", { x: PAD.l, y: 16, class: "chart-title" }, "Margins (% of revenue)"));
  for (let g = bottom; g <= top + 1e-9; g += 0.1) {
    const gy = y(g);
    root.append(svg("line", { x1: PAD.l, x2: W - PAD.r, y1: gy, y2: gy, class: Math.abs(g) < 1e-9 ? "axis" : "grid" }));
    root.append(svg("text", { x: PAD.l - 6, y: gy + 4, class: "tick", "text-anchor": "end" }, `${Math.round(g * 100)}%`));
  }
  table.years.forEach((yr, i) => root.append(svg("text", { x: x(i), y: H - 14, class: "tick", "text-anchor": "middle" }, shortLabel(yr.label))));
  SERIES.forEach((s) => {
    const cells = row(table, s.id)?.cells ?? [];
    // Break the line at missing values; never interpolate.
    let d = "";
    let pen = false;
    cells.forEach((c, i) => {
      if (c.value === null) {
        pen = false;
        return;
      }
      d += `${pen ? "L" : "M"}${x(i).toFixed(1)},${y(c.value).toFixed(1)} `;
      pen = true;
    });
    if (d) root.append(svg("path", { d: d.trim(), class: `line ${s.cls}`, fill: "none" }));
    cells.forEach((c, i) => {
      if (c.value === null) return;
      const dot = svg("circle", { cx: x(i), cy: y(c.value), r: 3.5, class: `dot ${s.cls}` });
      dot.append(svg("title", {}, `${table.years[i]!.label} ${s.name}: ${formatValue(c)}`));
      root.append(dot);
    });
  });
  // Legend (dash patterns, so color is not the only cue).
  // Narrow: one legend entry per row so nothing is clipped; wide: one row.
  SERIES.forEach((s, i) => {
    const lx = size.narrow ? PAD.l : PAD.l + 8 + i * 150;
    const ly = size.narrow ? H + 4 + i * 16 : H - 2;
    root.append(svg("line", { x1: lx, x2: lx + 22, y1: ly, y2: ly, class: `line ${s.cls}` }));
    root.append(svg("text", { x: lx + 28, y: ly + 4, class: "chart-legend" }, s.name));
  });
  root.setAttribute("viewBox", `0 0 ${W} ${size.narrow ? H + 4 + SERIES.length * 16 : H + 8}`);
  return root;
}
