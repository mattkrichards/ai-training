// Turns pasted notes / OCR text into issues, to-dos or rocks.
// Handles bullets, numbering, checkboxes, wrapped lines, owners named in the line,
// and (for rocks) indented sub-bullets as milestones plus due dates.
import { findDate } from "./dates.js";
import { memberName } from "./team.js";

const BULLET = /^(\s*)(?:[-*•‣◦▪▫●○■□☐☑☒✓✔➢➤>→·o«»®©¤°º¢]|\d{1,3}[.)]|[a-zA-Z][.)]|\[[ xX✓]?\]|\([ xX]?\))\s+/;
const HEADERS = /^(issues?|ids|to-?\s?dos?|todos?|action items?|rocks?|quarterly rocks?|milestones?|scorecard|notes?|agenda|headlines?|owner|title|due|status)\s*:?\s*$/i;

function cleanTitle(s) {
  return s
    .replace(/\s+/g, " ")
    .replace(/^[\s\-–—:;,.]+|[\s\-–—:;,]+$/g, "")
    .trim();
}

// Finds a team member mentioned at the start/end of a line, "(Name)", "@Name" or "Owner: Name".
function pullOwner(text, team) {
  if (!team.length) return { text, owner: "" };
  const people = team
    .map((m) => ({ full: memberName(m), first: (m.first_name || "").trim(), last: (m.last_name || "").trim() }))
    .filter((p) => p.full);
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  for (const p of people) {
    const names = [p.full, p.first && p.last ? `${p.first[0]}\\.? ?${esc(p.last)}` : null, p.first].filter(Boolean);
    for (const raw of names) {
      const n = raw === p.full || raw === p.first ? esc(raw) : raw;
      const patterns = [
        new RegExp(`\\s*\\(\\s*(?:owner:?\\s*)?${n}\\s*\\)`, "i"),
        new RegExp(`\\s*\\[\\s*${n}\\s*\\]`, "i"),
        new RegExp(`\\s*@${n}\\b`, "i"),
        new RegExp(`\\s*(?:owner|who|assigned to|assignee)\\s*[:=-]\\s*${n}\\b`, "i"),
        new RegExp(`^\\s*${n}\\s*[:\\-–—]\\s+`, "i"),
        new RegExp(`\\s+[\\-–—|:]\\s*${n}\\s*$`, "i"),
        new RegExp(`\\s*,\\s*${n}\\s*$`, "i"),
      ];
      for (const re of patterns) {
        if (re.test(text)) return { text: text.replace(re, " ").trim(), owner: p.full };
      }
    }
  }
  return { text, owner: "" };
}

function pullDate(text) {
  const found = findDate(text, "future");
  if (!found) return { text, date: "" };
  const re = new RegExp(`\\s*(?:\\(|\\[)?\\s*(?:due|by|eta|target|deadline)?\\s*:?\\s*${found.match.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")}\\s*(?:\\)|\\])?`, "i");
  return { text: text.replace(re, " ").trim(), date: found.date };
}

// Splits text into { indent, text, bulleted } lines, joining wrapped OCR lines.
function toLines(text) {
  const raw = String(text || "").replace(/\r/g, "").split("\n");
  const anyBullets = raw.some((l) => BULLET.test(l));
  const out = [];
  for (const line of raw) {
    if (!line.trim()) continue;
    const expanded = line.replace(/\t/g, "    ");
    const m = expanded.match(BULLET);
    const indent = (m ? m[1] : expanded.match(/^\s*/)[0]).length;
    const body = (m ? expanded.slice(m[0].length) : expanded).trim();
    if (!body || HEADERS.test(body) || /^page \d+( of \d+)?$/i.test(body)) continue;
    const prev = out[out.length - 1];
    // A line without a bullet in a bulleted list is a wrapped continuation of the item above.
    if (anyBullets && !m && prev && prev.bulleted && (indent > prev.indent || /^[a-z(]/.test(body))) {
      prev.text += " " + body;
      continue;
    }
    out.push({ indent, text: body, bulleted: !!m });
  }
  return out;
}

export function parseItems(text, { kind = "issues", team = [] } = {}) {
  const lines = toLines(text);
  if (!lines.length) return [];

  if (kind === "rocks") {
    const baseIndent = Math.min(...lines.map((l) => l.indent));
    const rocks = [];
    for (const l of lines) {
      const isChild = rocks.length && l.indent > baseIndent;
      if (isChild) {
        const d = pullDate(l.text);
        rocks[rocks.length - 1].milestones.push({ title: cleanTitle(d.text), due_date: d.date, done: false });
        continue;
      }
      const d = pullDate(l.text);
      const o = pullOwner(cleanTitle(d.text), team);
      rocks.push({ title: cleanTitle(o.text), owner: o.owner, due_date: d.date, milestones: [] });
    }
    return rocks.filter((r) => r.title);
  }

  return lines
    .map((l) => {
      const o = pullOwner(l.text, team);
      // "Title — longer explanation" → description, when the remainder is long enough to be one.
      let title = cleanTitle(o.text);
      let description = "";
      const split = title.match(/^(.{4,80}?)\s+[-–—:]\s+(.{12,})$/);
      if (split) {
        title = cleanTitle(split[1]);
        description = split[2].trim();
      }
      return { title, description, owner: o.owner };
    })
    .filter((i) => i.title);
}
