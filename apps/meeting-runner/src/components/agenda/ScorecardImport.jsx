// Quick Import of past scorecard numbers: paste from Excel/Sheets, drop a CSV/Excel/PDF/Word
// file, or paste a screenshot. Matches rows to existing metrics (or creates new ones) and
// fills in their weekly history.
import { useEffect, useRef, useState } from "react";
import { X, Upload, Wand2, ArrowLeft, Loader2, Plus } from "lucide-react";
import TeamSelect from "./TeamSelect";
import { ACCEPT, extractFromFile, fileFromClipboard, htmlTableFromClipboard } from "@/lib/extractText";
import { parseScorecard, textToRows, matchMetric, mergeScorecard } from "@/lib/parseScorecard";
import { todayIso } from "@/lib/dates";

export default function ScorecardImport({ metrics = [], team = [], defaultMetricId = null, onImport, onClose }) {
  const [text, setText] = useState("");
  const [gridRows, setGridRows] = useState(null); // rows from an Excel file or HTML paste
  const [found, setFound] = useState(null);
  const [weekFor, setWeekFor] = useState(todayIso());
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const fileRef = useRef(null);

  const readFile = async (file) => {
    setError("");
    try {
      setBusy(/^image\//.test(file.type) ? "Reading picture… 0%" : `Reading ${file.name}…`);
      const res = await extractFromFile(file, (p) => setBusy(`Reading picture… ${p}%`));
      if (res.rows) {
        setGridRows(res.rows);
        setText(res.rows.map((r) => r.map((c) => (c instanceof Date ? c.toISOString().slice(0, 10) : c)).join("\t")).join("\n"));
      } else {
        setGridRows(null);
        setText((res.text || "").trim());
      }
    } catch (e) {
      console.error(e);
      setError(e.message || "Couldn't read that file.");
    }
    setBusy("");
  };

  useEffect(() => {
    if (found) return undefined;
    const onPaste = (e) => {
      const file = fileFromClipboard(e);
      if (file) { e.preventDefault(); readFile(file); return; }
      const table = htmlTableFromClipboard(e);
      if (table && document.activeElement?.tagName !== "TEXTAREA") { e.preventDefault(); setGridRows(table); setText(table.map((r) => r.join("\t")).join("\n")); }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }); // eslint-disable-line react-hooks/exhaustive-deps

  const find = () => {
    const rows = gridRows && gridRows.map((r) => r.join("\t")).join("\n") === text ? gridRows : textToRows(text);
    const parsed = parseScorecard(rows, { team });
    if (!parsed.length) {
      setError("No scorecard numbers found. Paste a table with the metric names down the side and week dates across the top (or a Metric, Date, Value list).");
      return;
    }
    setError("");
    setFound(
      parsed.map((m, i) => {
        const match = matchMetric(m.name, metrics);
        // Unnamed list (just dates and values): goes to the metric the import was opened from,
        // or the only metric there is.
        const fallback = !m.name && (defaultMetricId || (metrics.length === 1 ? metrics[0].id : null));
        return {
          key: i,
          name: m.name,
          target: match ? match.id : fallback || (defaultMetricId && parsed.length === 1 ? defaultMetricId : "new"),
          owner: m.owner || "",
          goal: m.target ?? "",
          unit: m.unit || (/%/.test(m.name) ? "%" : /\$/.test(m.name) ? "$" : ""),
          higher_is_better: true,
          values: m.values,
        };
      })
    );
  };

  const update = (key, field, value) => setFound((fs) => fs.map((f) => (f.key === key ? { ...f, [field]: value } : f)));
  const undated = (found || []).some((f) => f.values.some((v) => !v.date));
  const active = (found || []).filter((f) => f.target !== "skip");
  // Counts weeks that will be saved (a repeated date counts once: the last value wins).
  const valueCount = active.reduce((n, f) => n + new Set(f.values.filter((v) => v.value !== null && v.value !== undefined).map((v) => v.date || "undated")).size, 0);
  const missingName = active.some((f) => f.target === "new" && !f.name.trim());
  const setValue = (key, i, patch) => setFound((fs) => fs.map((f) => (f.key === key ? { ...f, values: f.values.map((x, k) => (k === i ? { ...x, ...patch } : x)) } : f)));
  const removeValue = (key, i) => setFound((fs) => fs.map((f) => (f.key === key ? { ...f, values: f.values.filter((_, k) => k !== i) } : f)));
  const addValue = (key) => setFound((fs) => fs.map((f) => (f.key === key ? { ...f, values: [...f.values, { date: todayIso(), value: null }] } : f)));
  const dupDates = (f) => {
    const seen = new Set();
    const d = new Set();
    for (const v of f.values) { if (v.date && seen.has(v.date)) d.add(v.date); seen.add(v.date); }
    return [...d];
  };

  const doImport = async () => {
    setSaving(true);
    try {
      const rows = found.map((f) => ({ ...f, values: f.values.map((v) => ({ ...v, date: v.date || weekFor })) }));
      await onImport(mergeScorecard(metrics, rows));
      onClose();
    } catch (e) {
      console.error(e);
      setError(e.message || "Couldn't save.");
      setSaving(false);
    }
  };

  const input = "text-xs text-neutral-700 bg-white rounded-lg border border-neutral-200 px-2 py-1.5 outline-none focus:border-rs-slate";

  return (
    <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-3xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl text-neutral-900" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-5 border-b border-neutral-100">
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2"><Wand2 className="w-4 h-4" /> Import past scorecard data</h2>
            <p className="text-xs text-neutral-400 mt-0.5">
              {found ? "Match each row to a metric, then import." : "Paste from Excel or Sheets, paste a screenshot, or drop a CSV, Excel, PDF or Word file."}
            </p>
          </div>
          <button onClick={onClose} className="p-2 text-neutral-400 hover:text-neutral-700 rounded-lg"><X className="w-4 h-4" /></button>
        </div>

        {!found && (
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-3"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) readFile(f); }}>
            <textarea
              autoFocus
              value={text}
              onChange={(e) => { setText(e.target.value); setGridRows(null); }}
              placeholder={"Paste your scorecard here. Any of these work:\n\n• A list of dates and values for one metric\n   2026-11-18   90 %\n   2026-11-11   99.96 %\n\n• Weeks across the top\n   Measurable  Owner  Goal  11/3  11/10  11/17\n   Tickets closed  Matt  25  22  27  30\n\n• Metric, date and value on each line\n   Sales  11/3  $125,000"}
              rows={12}
              className="w-full text-sm text-neutral-800 bg-neutral-50 rounded-2xl border border-neutral-200 p-4 outline-none focus:border-rs-slate resize-y font-mono"
            />
            <div className="flex items-center gap-2 flex-wrap">
              <input ref={fileRef} type="file" accept={ACCEPT} className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) readFile(f); }} />
              <button onClick={() => fileRef.current?.click()} className="flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-xl border border-neutral-200 hover:bg-neutral-50">
                <Upload className="w-3.5 h-3.5" /> Choose file
              </button>
              <span className="text-[11px] text-neutral-400">Excel (.xlsx), CSV, PDF, Word, picture. Or drag it onto this window.</span>
            </div>
            {busy && <p className="text-xs text-neutral-600 flex items-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin" /> {busy}</p>}
            {error && <p className="text-xs text-red-600">{error}</p>}
          </div>
        )}

        {found && (
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
            {undated && (
              <div className="flex items-center gap-2 text-xs bg-amber-50 border border-amber-200 rounded-xl p-3">
                No week dates were found. Log these numbers for the week of
                <input type="date" value={weekFor} onChange={(e) => setWeekFor(e.target.value)} className={input} />
              </div>
            )}
            {found.map((f) => (
              <div key={f.key} className={`rounded-2xl border p-3 ${f.target === "skip" ? "opacity-50 border-neutral-100" : "border-neutral-200 bg-neutral-50"}`}>
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <span className="text-sm font-semibold flex-1 min-w-[10rem]">
                    {f.name || <span className="text-neutral-400 font-normal">List of {f.values.length} dated values. Pick the metric →</span>}
                  </span>
                  <select value={f.target} onChange={(e) => update(f.key, "target", e.target.value)} className={input}>
                    {metrics.map((m) => <option key={m.id} value={m.id}>Add to: {m.name}</option>)}
                    <option value="new">Create new metric</option>
                    <option value="skip">Skip this row</option>
                  </select>
                </div>
                {f.target === "new" && (
                  <div className="flex flex-wrap gap-2 mb-2">
                    <input value={f.name} onChange={(e) => update(f.key, "name", e.target.value)} placeholder="New metric name *" className={`${input} flex-1 min-w-[10rem] ${!f.name.trim() ? "border-amber-400" : ""}`} title="Metric name" />
                    <input type="number" value={f.goal} onChange={(e) => update(f.key, "goal", e.target.value)} placeholder="Goal" className={`${input} w-24`} />
                    <input value={f.unit} onChange={(e) => update(f.key, "unit", e.target.value)} placeholder="Unit" className={`${input} w-16`} />
                    <div className="w-44"><TeamSelect team={team} value={f.owner} onChange={(v) => update(f.key, "owner", v)} className={`${input} w-full`} /></div>
                    <select value={f.higher_is_better ? "up" : "down"} onChange={(e) => update(f.key, "higher_is_better", e.target.value === "up")} className={input}>
                      <option value="up">Higher is better</option>
                      <option value="down">Lower is better</option>
                    </select>
                  </div>
                )}
                <div className="flex flex-wrap gap-1.5">
                  {f.values.map((v, i) => (
                    <div key={i} className={`flex items-center gap-1 bg-white border rounded-lg pl-1.5 pr-1 py-1 ${dupDates(f).includes(v.date) ? "border-amber-400" : "border-neutral-200"}`}>
                      <input type="date" value={v.date || ""} onChange={(e) => setValue(f.key, i, { date: e.target.value })}
                        className="text-[11px] text-neutral-500 outline-none bg-transparent w-[7.5rem]" />
                      <input type="number" step="any" value={v.value ?? ""} placeholder="value"
                        onChange={(e) => setValue(f.key, i, { value: e.target.value === "" ? null : Number(e.target.value) })}
                        className="w-20 text-xs font-semibold text-neutral-800 outline-none bg-transparent" />
                      {f.unit && <span className="text-[11px] text-neutral-400">{f.unit}</span>}
                      <button onClick={() => removeValue(f.key, i)} title="Remove" className="text-neutral-300 hover:text-red-400"><X className="w-3 h-3" /></button>
                    </div>
                  ))}
                  <button onClick={() => addValue(f.key)} className="flex items-center gap-1 px-2 py-1 text-[11px] text-neutral-400 border border-dashed border-neutral-300 rounded-lg hover:text-neutral-700">
                    <Plus className="w-3 h-3" /> Add week
                  </button>
                </div>
                {dupDates(f).length > 0 && (
                  <p className="text-[11px] text-amber-600 mt-1.5">
                    {dupDates(f).join(", ")} appears more than once. Fix the date or remove one; otherwise the last value is kept.
                  </p>
                )}
              </div>
            ))}
            {error && <p className="text-xs text-red-600">{error}</p>}
          </div>
        )}

        <div className="flex items-center justify-between px-6 py-4 border-t border-neutral-100">
          {found ? (
            <button onClick={() => setFound(null)} className="flex items-center gap-1 text-xs text-neutral-500 hover:text-neutral-800"><ArrowLeft className="w-3.5 h-3.5" /> Back to data</button>
          ) : <span />}
          {found ? (
            <button onClick={doImport} disabled={!valueCount || saving || missingName} title={missingName ? "Name the new metric, or pick an existing one" : ""}
              className="px-5 py-2.5 bg-rs-red text-white text-sm font-semibold rounded-xl hover:bg-rs-red-deep disabled:opacity-40">
              {saving ? "Importing…" : `Import ${valueCount} value${valueCount === 1 ? "" : "s"}`}
            </button>
          ) : (
            <button onClick={find} disabled={!text.trim() || !!busy}
              className="px-5 py-2.5 bg-rs-red text-white text-sm font-semibold rounded-xl hover:bg-rs-red-deep disabled:opacity-40">
              Find numbers
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
