// Turns an agenda pasted as text, read from a screenshot (OCR) or pulled from a document
// into { title, items: [{ title, duration, presenter, notes, guessed }] }.
//
// Understands, per line:
//   Segue 5 min | Segue (5) | Segue - 5 minutes | 5 min Segue | IDS ....... 60 | IDS 1 hr | IDS 1:00 (h:mm)
//   9:00-9:05 Segue | 9:00 AM - 9:05 AM Segue | Segue 9:00–9:05
//   9:00 Segue / 9:05 Scorecard   (start times only: length = next start - this start)
// plus presenters named in the line ("- Matt", "(Janet)", "Presenter: Bobby").
import { memberName } from "./team.js";

const BULLET = /^\s*(?:[-*•‣◦▪▫●○■□☐☑☒✓✔➢➤>→·o«»®©¤°º¢]|\d{1,3}[.)]|[a-zA-Z][.)]|\[[ xX✓]?\])\s+/;
const T = String.raw`(\d{1,2})(?::(\d{2}))\s*([ap]\.?m?\.?)?|(\d{1,2})\s*([ap]\.?m\.?)`;
const RANGE = new RegExp(String.raw`(?:${T})\s*(?:-|–|—|to|until)\s*(?:${T})`, "i");
const SINGLE_TIME = new RegExp(String.raw`(?:^|\s)(?:${T})(?=\s|$|[-–—:|.,])`, "i");
const SKIP = /^(total|totals?\s*time|date|time|location|where|when|attendees?|facilitator|scribe|page \d+|notes?)\b\s*[:\-]?/i;
const TITLE_HINT = /\b(agenda|meeting|l-?10|level\s*10|weekly|monthly|quarterly|annual|huddle|sync|stand-?up|review)\b/i;

function toMinutes(h, m, ap, refPm) {
  h = Number(h);
  m = Number(m || 0);
  const a = (ap || "").toLowerCase();
  if (a.startsWith("p") && h < 12) h += 12;
  if (a.startsWith("a") && h === 12) h = 0;
  if (!a && refPm && h < 12 && h < 8) h += 12; // "1:00" after a morning start is afternoon
  return h * 60 + m;
}

function readTime(match, offset) {
  // T has two alternatives: h:mm [ap]  |  h ap
  const g = match.slice(offset, offset + 5);
  if (g[0] !== undefined) return { h: g[0], m: g[1], ap: g[2] };
  return { h: g[3], m: "00", ap: g[4] };
}

function pullPresenter(text, team) {
  const people = team.map((m) => ({ full: memberName(m), first: (m.first_name || "").trim() })).filter((p) => p.full);
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  for (const p of people) {
    for (const n of [p.full, p.first].filter(Boolean).map(esc)) {
      const pats = [
        new RegExp(String.raw`\s*\(\s*(?:presenter:?\s*|led by\s*)?${n}\s*\)`, "i"),
        new RegExp(String.raw`\s*\[\s*${n}\s*\]`, "i"),
        new RegExp(String.raw`\s*(?:presenter|presented by|led by|owner|lead)\s*[:\-]?\s*${n}\b`, "i"),
        new RegExp(String.raw`\s+[-–—|:]\s*${n}\s*$`, "i"),
        new RegExp(String.raw`\s*@${n}\b`, "i"),
      ];
      for (const re of pats) if (re.test(text)) return { text: text.replace(re, " ").trim(), presenter: p.full };
    }
  }
  // "Presenter: someone not on the team" → keep the name as typed
  const m = text.match(/\s*(?:presenter|presented by|led by)\s*[:\-]\s*([A-Z][\w.'-]*(?:\s+[A-Z][\w.'-]*)?)\s*$/);
  if (m) return { text: text.replace(m[0], " ").trim(), presenter: m[1] };
  return { text, presenter: "" };
}

const clean = (s) =>
  s
    .replace(/\.{2,}|…+|_{2,}/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^[\s\-–—:|,.]+|[\s\-–—:|,(]+$/g, "")
    .trim();

export function parseAgenda(text, { team = [] } = {}) {
  const raw = String(text || "").replace(/\r/g, "").split("\n");
  const lines = [];
  for (const line of raw) {
    if (!line.trim()) continue;
    const bulleted = BULLET.test(line);
    const indent = (line.replace(/\t/g, "    ").match(/^\s*/) || [""])[0].length;
    lines.push({ text: line.replace(BULLET, "").replace(/\t/g, "  ").trim(), bulleted, indent });
  }

  let title = "";
  const items = [];
  let sawPm = false;

  for (const l of lines) {
    let t = l.text;
    if (!t) continue;
    let duration = null;
    let start = null;
    let end = null;

    // time range "9:00-9:05"
    const r = t.match(RANGE);
    if (r) {
      const a = readTime(r, 1);
      const b = readTime(r, 6);
      if (/p/i.test(a.ap || "") || /p/i.test(b.ap || "")) sawPm = true;
      start = toMinutes(a.h, a.m, a.ap || (b.ap && Number(a.h) <= Number(b.h) ? b.ap : ""), sawPm);
      end = toMinutes(b.h, b.m, b.ap, sawPm);
      if (end < start) end += 12 * 60;
      duration = end - start;
      t = t.replace(r[0], " ");
    }

    // explicit length "5 min", "1 hr", "1.5 hours", "(5)", "..... 10", "1:00" (h:mm length)
    if (duration === null) {
      const d =
        t.match(/(\d+(?:\.\d+)?)\s*(hours?|hrs?|h)\b(?:\s*(\d+)\s*(?:minutes?|mins?|m)\b)?/i) ||
        t.match(/(\d+(?:\.\d+)?)\s*(minutes?|mins?|min\.?|m)\b/i);
      if (d) {
        const n = parseFloat(d[1]);
        duration = /^h/i.test(d[2]) ? Math.round(n * 60 + Number(d[3] || 0)) : Math.round(n);
        t = t.replace(d[0], " ");
      } else {
        const p = t.match(/\(\s*(\d{1,3})\s*\)\s*$/) || t.match(/(?:\.{2,}|…|_{2,}|\s{2,}|[-–—|])\s*(\d{1,3})\s*$/) || t.match(/^(\d{1,3})\s*(?:[-–—|:]\s+|\s{2,})/);
        if (p && Number(p[1]) > 0 && Number(p[1]) <= 240) {
          duration = Number(p[1]);
          t = t.replace(p[0], " ");
        }
      }
    }

    // a single start time "9:00 Segue"
    if (duration === null && start === null) {
      const s = t.match(SINGLE_TIME);
      if (s) {
        const a = readTime(s, 1);
        if (/p/i.test(a.ap || "")) sawPm = true;
        start = toMinutes(a.h, a.m, a.ap, sawPm && !a.ap);
        t = t.replace(s[0], " ");
      }
    }

    const pr = pullPresenter(t.replace(/\.{2,}|…+|_{2,}/g, " ").replace(/[\s\-–—|:,]+$/, "").trim(), team);
    const name = clean(pr.text);
    if (!name || SKIP.test(name)) continue;

    const isTimed = duration !== null || start !== null;
    if (!isTimed) {
      // Title: an untimed heading before any items
      if (!items.length && !title && (TITLE_HINT.test(name) || !l.bulleted)) {
        title = name;
        continue;
      }
      // Sub-bullet / indented line under an item → notes for that item
      const prev = items[items.length - 1];
      if (prev && (l.indent > prev.indent || (l.bulleted && !prev.bulleted) || /^[a-z]/.test(name))) {
        prev.notes = prev.notes ? `${prev.notes}\n${name}` : name;
        continue;
      }
    }
    items.push({ title: name, duration, presenter: pr.presenter, notes: "", start, end, indent: l.indent, bulleted: l.bulleted });
  }

  // Start times only: length = next start − this start (last one uses its end time, else 10)
  items.forEach((it, i) => {
    if (it.duration !== null) return;
    if (it.start !== null) {
      const next = items.slice(i + 1).find((x) => x.start !== null);
      if (next) {
        let diff = next.start - it.start;
        if (diff <= 0) diff += 12 * 60;
        if (diff > 0 && diff <= 240) it.duration = diff;
      }
    }
  });

  return {
    title,
    items: items.map((it) => ({
      title: it.title,
      duration: it.duration ?? 10,
      guessed: it.duration === null,
      presenter: it.presenter,
      notes: it.notes,
    })),
  };
}
