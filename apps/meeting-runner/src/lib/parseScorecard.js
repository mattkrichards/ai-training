// Reads past scorecard data from a grid of cells (Excel/Sheets paste, CSV, .xlsx, PDF table,
// or OCR text) and returns metrics with dated values.
//
// Layouts handled:
//   wide        Measurable | Owner | Goal | 11/3 | 11/10 | 11/17 ...   (one row per metric)
//   transposed  Week | Sales | Tickets | ...                            (one row per week)
//   long        Metric | Date | Value                                  (one row per entry)
import { findDate, looksLikeDate } from "./dates.js";
import { memberName } from "./team.js";

export function parseNumber(v) {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (v instanceof Date || v === null || v === undefined) return null;
  let s = String(v).trim();
  if (!s || /^[-–—]+$|^n\/?a$/i.test(s)) return null;
  const neg = /^\(.*\)$/.test(s);
  s = s.replace(/[()$€£%,\s]/g, "").replace(/^[<>≥≤=]+/, "");
  let mult = 1;
  if (/k$/i.test(s)) { mult = 1000; s = s.slice(0, -1); }
  else if (/m$/i.test(s)) { mult = 1000000; s = s.slice(0, -1); }
  if (!/^-?\d*\.?\d+$/.test(s)) return null;
  const n = Number(s) * mult;
  return neg ? -n : n;
}

const isNumeric = (v) => parseNumber(v) !== null;
const NAME_HDR = /measurable|metric|kpi|name|measure|item/i;
const OWNER_HDR = /owner|who|responsible/i;
const GOAL_HDR = /goal|target/i;
const DATE_HDR = /^(date|week|period|week of|week ending)$/i;
const VALUE_HDR = /^(value|actual|result|amount|number)$/i;

// Text → rows of cells. Tabs (Excel paste) > commas (CSV) > 2+ spaces > OCR token split.
export function textToRows(text) {
  const lines = String(text || "").replace(/\r/g, "").split("\n").filter((l) => l.trim());
  if (!lines.length) return [];
  if (lines.some((l) => l.includes("\t"))) return lines.map((l) => l.split("\t").map((c) => c.trim()));
  const commaCounts = lines.map((l) => (l.match(/,/g) || []).length);
  if (commaCounts.filter((c) => c >= 2).length >= Math.max(2, lines.length * 0.6)) {
    return lines.map(splitCsvLine);
  }
  if (lines.filter((l) => / {2,}/.test(l.trim())).length >= lines.length * 0.6) {
    return lines.map((l) => l.trim().split(/ {2,}/));
  }
  // OCR text: words up to the first number/date are the label, the rest are separate cells.
  return lines.map((l) => {
    const tokens = l.trim().split(/\s+/);
    const cells = [];
    let label = [];
    for (let i = 0; i < tokens.length; i++) {
      const t = tokens[i];
      const two = `${t} ${tokens[i + 1] || ""}`;
      if (/^[a-z]{3,9}\.?$/i.test(t) && /^\d{1,2}(st|nd|rd|th)?,?$/.test(tokens[i + 1] || "") && findDate(two, "past")) {
        if (label.length) { cells.push(label.join(" ")); label = []; }
        cells.push(two); i++; continue;
      }
      if (isNumeric(t) || findDate(t, "past")) {
        if (label.length) { cells.push(label.join(" ")); label = []; }
        cells.push(t);
      } else label.push(t);
    }
    if (label.length) cells.push(label.join(" "));
    return cells;
  });
}

function splitCsvLine(line) {
  const out = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { if (q && line[i + 1] === '"') { cur += '"'; i++; } else q = !q; }
    else if (ch === "," && !q) { out.push(cur.trim()); cur = ""; }
    else cur += ch;
  }
  out.push(cur.trim());
  return out;
}

function teamName(v, team) {
  const s = String(v || "").trim().toLowerCase();
  if (!s) return "";
  const hit = team.find((m) => {
    const full = memberName(m).toLowerCase();
    return full === s || (m.first_name || "").toLowerCase() === s ||
      `${(m.first_name || "")[0] || ""}${(m.last_name || "")[0] || ""}`.toLowerCase() === s;
  });
  return hit ? memberName(hit) : "";
}

export function parseScorecard(rows, { team = [] } = {}) {
  rows = (rows || []).map((r) => r.map((c) => (typeof c === "string" ? c.trim() : c))).filter((r) => r.some((c) => c !== "" && c !== null && c !== undefined));
  if (!rows.length) return [];

  // ── long format: header has a date column and a value column
  const hdrIdx = rows.findIndex((r) => r.some((c) => DATE_HDR.test(String(c))) && r.some((c) => VALUE_HDR.test(String(c))));
  if (hdrIdx >= 0) {
    const h = rows[hdrIdx].map((c) => String(c));
    const di = h.findIndex((c) => DATE_HDR.test(c));
    const vi = h.findIndex((c) => VALUE_HDR.test(c));
    const ni = h.findIndex((c, i) => i !== di && i !== vi && NAME_HDR.test(c));
    const oi = h.findIndex((c) => OWNER_HDR.test(c));
    const gi = h.findIndex((c) => GOAL_HDR.test(c));
    const byName = new Map();
    for (const r of rows.slice(hdrIdx + 1)) {
      const name = ni >= 0 ? String(r[ni] || "").trim() : "Metric";
      const date = findDate(r[di], "past")?.date;
      const value = parseNumber(r[vi]);
      if (!name || !date || value === null) continue;
      if (!byName.has(name)) byName.set(name, { name, owner: oi >= 0 ? teamName(r[oi], team) : "", target: gi >= 0 ? parseNumber(r[gi]) : null, values: [] });
      byName.get(name).values.push({ date, value });
    }
    return finish([...byName.values()]);
  }

  // ── wide format: a header row with 2+ dates across
  const dateCount = (r) => r.filter((c) => looksLikeDate(c)).length;
  let wideHdr = -1;
  for (let i = 0; i < Math.min(rows.length, 15); i++) if (dateCount(rows[i]) >= 2) { wideHdr = i; break; }

  // ── transposed: first column has 2+ dates going down
  const firstColDates = rows.filter((r) => looksLikeDate(r[0])).length;

  if (wideHdr >= 0 && (firstColDates < 2 || dateCount(rows[wideHdr]) >= firstColDates)) {
    const h = rows[wideHdr];
    const dateCols = h.map((c, i) => (looksLikeDate(c) ? { i, date: findDate(c, "past").date } : null)).filter(Boolean);
    const firstDateCol = dateCols[0].i;
    const hs = h.map((c) => String(c || ""));
    let ni = hs.findIndex((c, i) => i < firstDateCol && NAME_HDR.test(c));
    const oi = hs.findIndex((c, i) => i < firstDateCol && OWNER_HDR.test(c));
    const gi = hs.findIndex((c, i) => i < firstDateCol && GOAL_HDR.test(c));
    const out = [];
    for (const r of rows.slice(wideHdr + 1)) {
      // Name: the named column, else the longest non-numeric, non-team cell before the dates.
      let name = ni >= 0 ? String(r[ni] || "").trim() : "";
      let owner = oi >= 0 ? teamName(r[oi], team) : "";
      const lead = r.slice(0, firstDateCol);
      if (!name) {
        const cands = lead.map((c, i) => ({ c: String(c || "").trim(), i })).filter(({ c, i }) => c && !isNumeric(c) && i !== oi && i !== gi && !teamName(c, team));
        name = cands.sort((a, b) => b.c.length - a.c.length)[0]?.c || "";
      }
      if (!owner) owner = lead.map((c) => teamName(c, team)).find(Boolean) || "";
      let target = gi >= 0 ? parseNumber(r[gi]) : null;
      if (target === null && gi < 0) {
        const nums = lead.map(parseNumber).filter((n) => n !== null);
        if (nums.length === 1) target = nums[0];
      }
      // OCR rows lose empty cells; line values up with the date columns from the right.
      let cells = dateCols.map((d) => r[d.i]);
      if (r.length !== h.length) {
        // Cells got merged or dropped (OCR). Values are the last numbers on the row; one extra
        // number before them is the goal.
        const nums = r.filter((c, i) => i > 0 && isNumeric(c));
        const vals = nums.slice(-dateCols.length);
        const extra = nums.slice(0, nums.length - vals.length);
        if (target === null && extra.length === 1) target = parseNumber(extra[0]);
        cells = dateCols.map((_, k) => vals[k - (dateCols.length - vals.length)]);
      }
      const values = dateCols
        .map((d, k) => ({ date: d.date, value: parseNumber(cells[k]) }))
        .filter((v) => v.value !== null);
      if (name && values.length) out.push({ name, owner, target, values });
    }
    return finish(out);
  }

  if (firstColDates >= 2) {
    const hdr = rows.find((r) => !looksLikeDate(r[0])) || [];
    const out = hdr.slice(1).map((name, k) => ({ name: String(name || "").trim(), owner: "", target: null, values: [] }));
    for (const r of rows.filter((x) => looksLikeDate(x[0]))) {
      const date = findDate(r[0], "past").date;
      r.slice(1).forEach((c, k) => {
        const value = parseNumber(c);
        if (out[k] && value !== null) out[k].values.push({ date, value });
      });
    }
    return finish(out.filter((m) => m.name));
  }

  // ── no dates found: "Metric  value" lines for a single week (date picked in the preview)
  const out = rows
    .map((r) => {
      const name = r.find((c) => c && !isNumeric(c) && !teamName(c, team));
      const nums = r.map(parseNumber).filter((n) => n !== null);
      return name && nums.length ? { name: String(name), owner: r.map((c) => teamName(c, team)).find(Boolean) || "", target: nums.length > 1 ? nums[0] : null, values: [{ date: null, value: nums[nums.length - 1] }] } : null;
    })
    .filter(Boolean);
  return finish(out);
}

function finish(list) {
  return list
    .filter((m) => m.name && m.values.length)
    .map((m) => {
      const byDate = new Map();
      for (const v of m.values) byDate.set(v.date, v.value);
      return { ...m, values: [...byDate.entries()].map(([date, value]) => ({ date, value })).sort((a, b) => String(a.date).localeCompare(String(b.date))) };
    });
}

const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");

// Best existing metric for an imported name: exact, then contains, else null.
export function matchMetric(name, metrics) {
  const n = norm(name);
  if (!n) return null;
  return (
    metrics.find((m) => norm(m.name) === n) ||
    metrics.find((m) => norm(m.name).length > 3 && (n.includes(norm(m.name)) || norm(m.name).includes(n))) ||
    null
  );
}

const genId = () => Math.random().toString(36).slice(2, 9);

// rows: [{ target: metricId | "new" | "skip", name, owner, goal, unit, values:[{date,value}] }]
// Returns a new scorecard array. Imported values replace an existing entry for the same date.
export function mergeScorecard(metrics, rows) {
  const out = metrics.map((m) => ({ ...m, history: [...(m.history || [])] }));
  for (const r of rows) {
    if (r.target === "skip") continue;
    let metric = out.find((m) => m.id === r.target);
    if (!metric) {
      metric = {
        id: genId(),
        name: r.name.trim(),
        description: "",
        target: Number(r.goal) || 0,
        unit: r.unit || "",
        owner: r.owner || "",
        higher_is_better: r.higher_is_better !== false,
        history: [],
      };
      out.push(metric);
    }
    for (const v of r.values) {
      if (!v.date || v.value === null || v.value === undefined) continue;
      const hit = metric.history.find((h) => h.date === v.date);
      if (hit) hit.value = v.value;
      else metric.history.push({ id: genId(), date: v.date, value: v.value });
    }
    metric.history.sort((a, b) => a.date.localeCompare(b.date));
  }
  return out;
}
