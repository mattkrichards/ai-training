// Date helpers for imports. Everything returns ISO "YYYY-MM-DD" or null.

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const pad = (n) => String(n).padStart(2, "0");
export const iso = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;
export const todayIso = () => {
  const t = new Date();
  return iso(t.getFullYear(), t.getMonth() + 1, t.getDate());
};

function valid(y, m, d) {
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(y, m - 1, d);
  return dt.getMonth() === m - 1;
}

function fixYear(y) {
  if (y === undefined || y === null || y === "") return null;
  y = Number(y);
  return y < 100 ? 2000 + y : y;
}

// mode "past": a date with no year is assumed to be in the past or this week (scorecards).
// mode "future": a date with no year is assumed to be upcoming (due dates).
function guessYear(m, d, mode) {
  const now = new Date();
  let y = now.getFullYear();
  const dt = new Date(y, m - 1, d);
  const days = (dt - now) / 86400000;
  if (mode === "past" && days > 14) y -= 1;
  if (mode === "future" && days < -60) y += 1;
  return y;
}

// Finds the first date in a string. Returns { date, match } or null.
export function findDate(str, mode = "future") {
  if (str instanceof Date && !isNaN(str)) return { date: iso(str.getFullYear(), str.getMonth() + 1, str.getDate()), match: "" };
  if (typeof str === "number") {
    // Excel serial date (days since 1899-12-30)
    if (str > 20000 && str < 80000) {
      const dt = new Date(Math.round((str - 25569) * 86400000));
      return { date: iso(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate()), match: String(str) };
    }
    return null;
  }
  const s = String(str || "");
  let m;
  if ((m = s.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/))) {
    const [, y, mo, d] = m.map(Number);
    if (valid(y, mo, d)) return { date: iso(y, mo, d), match: m[0] };
  }
  if ((m = s.match(/\b(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?\b/))) {
    const mo = Number(m[1]);
    const d = Number(m[2]);
    const y = fixYear(m[3]) ?? guessYear(mo, d, mode);
    if (valid(y, mo, d)) return { date: iso(y, mo, d), match: m[0] };
  }
  if ((m = s.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(\d{4}))?\b/i))) {
    const mo = MONTHS.indexOf(m[1].slice(0, 3).toLowerCase()) + 1;
    const d = Number(m[2]);
    const y = fixYear(m[3]) ?? guessYear(mo, d, mode);
    if (valid(y, mo, d)) return { date: iso(y, mo, d), match: m[0] };
  }
  if ((m = s.match(/\b(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?(?:\s+(\d{4}))?\b/i))) {
    const mo = MONTHS.indexOf(m[2].slice(0, 3).toLowerCase()) + 1;
    const d = Number(m[1]);
    const y = fixYear(m[3]) ?? guessYear(mo, d, mode);
    if (valid(y, mo, d)) return { date: iso(y, mo, d), match: m[0] };
  }
  return null;
}

export const looksLikeDate = (v) => !!findDate(v, "past") && (typeof v !== "string" || v.replace(/week\s*(of|ending)?|w\/?e|we\b|[:#]/gi, "").trim().length <= 24);
