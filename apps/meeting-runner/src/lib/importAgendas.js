// Imports agendas exported from Base44 (Dashboard → Data → Agenda → Export as CSV),
// or a JSON array of agenda records. Original IDs are kept so existing links still work.
import Papa from "papaparse";

const ARRAY_FIELDS = ["items", "issues", "todos", "rocks", "scorecard", "team"];

function parseMaybeJson(value) {
  if (typeof value !== "string") return value;
  const t = value.trim();
  if (!t) return undefined;
  if ((t.startsWith("[") && t.endsWith("]")) || (t.startsWith("{") && t.endsWith("}"))) {
    try { return JSON.parse(t); } catch { /* leave as text */ }
  }
  return value;
}

export async function readAgendaFile(file) {
  const text = await file.text();
  let rows;
  if (file.name.toLowerCase().endsWith(".json") || text.trim().startsWith("[")) {
    const data = JSON.parse(text);
    rows = Array.isArray(data) ? data : [data];
  } else {
    const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
    rows = parsed.data;
  }
  return rows
    .map((row) => {
      const rec = {};
      for (const [k, v] of Object.entries(row)) {
        const key = k.trim();
        if (!key) continue;
        const val = parseMaybeJson(v);
        if (val !== undefined) rec[key] = val;
      }
      for (const f of ARRAY_FIELDS) if (!Array.isArray(rec[f])) rec[f] = [];
      return rec;
    })
    .filter((r) => r.title);
}
