// Import an agenda from a pasted screenshot, pasted text, or a Word/PDF/picture/text file.
// Finds the meeting name and each item's minutes and presenter, then lets you review.
import { useEffect, useRef, useState } from "react";
import { X, Upload, Wand2, ArrowLeft, Loader2, Trash2, Plus, Clock } from "lucide-react";
import TeamSelect from "./TeamSelect";
import { ACCEPT, extractFromFile, fileFromClipboard } from "@/lib/extractText";
import { parseAgenda } from "@/lib/parseAgenda";

const EXAMPLE = "Leadership L10\nSegue  5 min\nScorecard  5 min\nRock Review  5 min\nIDS  60 min\nConclude  5 min\n\nTimes work too: 9:00-9:05 Segue, or 9:00 AM Segue";

export default function AgendaImport({ team = [], currentTitle = "", hasItems = false, onImport, onClose }) {
  const [text, setText] = useState("");
  const [found, setFound] = useState(null);
  const [name, setName] = useState("");
  const [mode, setMode] = useState(hasItems ? "append" : "replace");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const fileRef = useRef(null);

  const readFile = async (file) => {
    setError("");
    try {
      setBusy(/^image\//.test(file.type) ? "Reading picture… 0%" : `Reading ${file.name}…`);
      const res = await extractFromFile(file, (p) => setBusy(`Reading picture… ${p}%`));
      const t = res.rows ? res.rows.map((r) => r.join("\t")).join("\n") : res.text;
      setText((prev) => (prev.trim() ? prev.trim() + "\n" : "") + (t || "").trim());
      if (!(t || "").trim()) setError("No text was found in that file.");
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
      if (file) { e.preventDefault(); readFile(file); }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }); // eslint-disable-line react-hooks/exhaustive-deps

  const find = () => {
    const r = parseAgenda(text, { team });
    if (!r.items.length) {
      setError("No agenda items found. Put one item per line, with its minutes or start time if you have them.");
      return;
    }
    setError("");
    setName(currentTitle || r.title);
    setFound(r.items.map((it, i) => ({ ...it, key: i })));
  };

  const update = (key, field, value) => setFound((fs) => fs.map((f) => (f.key === key ? { ...f, [field]: value, ...(field === "duration" ? { guessed: false } : {}) } : f)));
  const total = (found || []).reduce((n, f) => n + (Number(f.duration) || 0), 0);
  const valid = (found || []).filter((f) => f.title.trim());

  const doImport = () => {
    onImport({
      title: name.trim(),
      mode,
      items: valid.map((f) => ({ title: f.title.trim(), duration: Number(f.duration) || 0, presenter: f.presenter || "", notes: f.notes || "" })),
    });
    onClose();
  };

  const input = "text-xs text-neutral-700 bg-white rounded-lg border border-neutral-200 px-2 py-1.5 outline-none focus:border-neutral-400";

  return (
    <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl text-neutral-900" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-5 border-b border-neutral-100">
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2"><Wand2 className="w-4 h-4" /> Import agenda</h2>
            <p className="text-xs text-neutral-400 mt-0.5">
              {found ? "Check the items and minutes, then add them." : "Paste a screenshot (Ctrl+V) or text, or drop a Word, PDF or picture file."}
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
              onChange={(e) => setText(e.target.value)}
              placeholder={`Paste here. Ctrl+V works for screenshots too. For example:\n\n${EXAMPLE}`}
              rows={12}
              className="w-full text-sm text-neutral-800 bg-neutral-50 rounded-2xl border border-neutral-200 p-4 outline-none focus:border-neutral-400 resize-y font-mono"
            />
            <div className="flex items-center gap-2 flex-wrap">
              <input ref={fileRef} type="file" accept={ACCEPT} className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) readFile(f); }} />
              <button onClick={() => fileRef.current?.click()} className="flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-xl border border-neutral-200 hover:bg-neutral-50">
                <Upload className="w-3.5 h-3.5" /> Choose file
              </button>
              <span className="text-[11px] text-neutral-400">Picture, Word (.docx), PDF or text. Or drag it onto this window.</span>
            </div>
            {busy && <p className="text-xs text-neutral-600 flex items-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin" /> {busy}</p>}
            {error && <p className="text-xs text-red-600">{error}</p>}
          </div>
        )}

        {found && (
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Meeting name" className={`${input} flex-1 min-w-[12rem] text-sm font-semibold`} />
              <span className="flex items-center gap-1 text-xs text-neutral-500"><Clock className="w-3.5 h-3.5" /> {total} min</span>
            </div>
            {hasItems && (
              <div className="flex gap-4 text-xs text-neutral-600">
                <label className="flex items-center gap-1.5"><input type="radio" checked={mode === "append"} onChange={() => setMode("append")} /> Add after the current items</label>
                <label className="flex items-center gap-1.5"><input type="radio" checked={mode === "replace"} onChange={() => setMode("replace")} /> Replace the current items</label>
              </div>
            )}
            <div className="space-y-2">
              {found.map((f) => (
                <div key={f.key} className="rounded-2xl border border-neutral-200 bg-neutral-50 p-3">
                  <div className="flex items-center gap-2">
                    <input value={f.title} onChange={(e) => update(f.key, "title", e.target.value)} className={`${input} flex-1 text-sm font-semibold`} />
                    <div className={`flex items-center gap-1 rounded-lg border px-2 py-1 bg-white ${f.guessed ? "border-amber-400" : "border-neutral-200"}`} title={f.guessed ? "No time found for this item. Check the minutes." : ""}>
                      <input type="number" min="0" value={f.duration} onChange={(e) => update(f.key, "duration", e.target.value === "" ? "" : Number(e.target.value))} className="w-12 text-xs font-semibold text-right outline-none bg-transparent" />
                      <span className="text-[11px] text-neutral-400">min</span>
                    </div>
                    <button onClick={() => setFound((fs) => fs.filter((x) => x.key !== f.key))} className="p-1.5 text-neutral-300 hover:text-red-400" title="Remove"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                  <div className="flex gap-2 mt-1.5">
                    <div className="w-48"><TeamSelect team={team} value={f.presenter} emptyLabel="No presenter" onChange={(v) => update(f.key, "presenter", v)} className={`${input} w-full`} /></div>
                    <input value={f.notes} onChange={(e) => update(f.key, "notes", e.target.value)} placeholder="Notes (optional)" className={`${input} flex-1`} />
                  </div>
                  {f.guessed && <p className="text-[11px] text-amber-600 mt-1">No time found for this item. Set to {f.duration} min.</p>}
                </div>
              ))}
              <button onClick={() => setFound((fs) => [...fs, { key: Date.now(), title: "", duration: 5, presenter: "", notes: "" }])}
                className="w-full flex items-center justify-center gap-1 py-2 text-xs text-neutral-400 border-2 border-dashed border-neutral-200 rounded-2xl hover:text-neutral-600">
                <Plus className="w-3.5 h-3.5" /> Add an item
              </button>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between px-6 py-4 border-t border-neutral-100">
          {found ? (
            <button onClick={() => setFound(null)} className="flex items-center gap-1 text-xs text-neutral-500 hover:text-neutral-800"><ArrowLeft className="w-3.5 h-3.5" /> Back to text</button>
          ) : <span />}
          {found ? (
            <button onClick={doImport} disabled={!valid.length} className="px-5 py-2.5 bg-neutral-900 text-white text-sm font-semibold rounded-xl hover:bg-neutral-700 disabled:opacity-40">
              {`Use ${valid.length} item${valid.length === 1 ? "" : "s"}`}
            </button>
          ) : (
            <button onClick={find} disabled={!text.trim() || !!busy} className="px-5 py-2.5 bg-neutral-900 text-white text-sm font-semibold rounded-xl hover:bg-neutral-700 disabled:opacity-40">
              Find agenda items
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
