// Quick Import for issues, to-dos and rocks: paste text or a screenshot, or drop a file
// (Word, PDF, picture, text). Shows the items it found for review before adding them.
import { useEffect, useRef, useState } from "react";
import { X, Upload, Wand2, ArrowLeft, Loader2, Trash2, Plus } from "lucide-react";
import TeamSelect from "./TeamSelect";
import { ACCEPT, extractFromFile, fileFromClipboard } from "@/lib/extractText";
import { parseItems } from "@/lib/parseItems";

const LABELS = {
  issues: { one: "issue", many: "issues", owner: "Owner" },
  todos: { one: "to-do", many: "to-dos", owner: "Assignee" },
  rocks: { one: "rock", many: "rocks", owner: "Owner" },
};

const PLACEHOLDER = {
  issues: "Freight costs up on Fort Worth deliveries - Janet\nThin clients dropping AVD sessions (Matt)\nScanner batteries in Waco",
  todos: "Call vendor about price increase @Matt\n[ ] Send Q4 forecast to Eric — Janet\nOrder new label printer",
  rocks: "Proton two-way P21 integration - Matt - due 1/29\n    - Map customer fields 12/5\n    - Test sync in sandbox 12/19\nRX VMI launch (Janet) 1/15",
};

export default function QuickImport({ kind, team = [], existing = [], onImport, onClose }) {
  const L = LABELS[kind];
  const [text, setText] = useState("");
  const [rows, setRows] = useState(null); // null = input step
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const fileRef = useRef(null);
  const existingTitles = new Set(existing.map((t) => (t || "").trim().toLowerCase()));

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
    if (rows) return undefined;
    const onPaste = (e) => {
      const file = fileFromClipboard(e);
      if (file) {
        e.preventDefault();
        readFile(file);
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }); // eslint-disable-line react-hooks/exhaustive-deps

  const find = () => {
    const found = parseItems(text, { kind, team }).map((r, i) => ({
      ...r,
      key: i,
      include: !existingTitles.has(r.title.toLowerCase()),
      duplicate: existingTitles.has(r.title.toLowerCase()),
      milestonesText: (r.milestones || []).map((m) => (m.due_date ? `${m.title} | ${m.due_date}` : m.title)).join("\n"),
    }));
    if (!found.length) {
      setError(`No ${L.many} found. Put one per line, or use bullets.`);
      return;
    }
    setError("");
    setRows(found);
  };

  const update = (key, field, value) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, [field]: value } : r)));
  const chosen = (rows || []).filter((r) => r.include && r.title.trim());

  const doImport = async () => {
    setSaving(true);
    try {
      await onImport(
        chosen.map((r) => ({
          title: r.title.trim(),
          description: (r.description || "").trim(),
          owner: r.owner || "",
          due_date: r.due_date || "",
          milestones: (r.milestonesText || "")
            .split("\n")
            .map((l) => l.trim())
            .filter(Boolean)
            .map((l) => {
              const [t, d] = l.split("|").map((x) => x.trim());
              return { title: t, due_date: /^\d{4}-\d{2}-\d{2}$/.test(d || "") ? d : "", done: false };
            }),
        }))
      );
      onClose();
    } catch (e) {
      console.error(e);
      setError(e.message || "Couldn't save.");
      setSaving(false);
    }
  };

  const input = "w-full text-xs text-neutral-700 bg-white rounded-lg border border-neutral-200 px-2 py-1.5 outline-none focus:border-neutral-400";

  return (
    <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl text-neutral-900" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-5 border-b border-neutral-100">
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2"><Wand2 className="w-4 h-4" /> Quick Import {L.many}</h2>
            <p className="text-xs text-neutral-400 mt-0.5">
              {rows ? `Check the ${L.many} found, then add them.` : "Paste notes or a screenshot, or drop a Word, PDF, picture or text file."}
            </p>
          </div>
          <button onClick={onClose} className="p-2 text-neutral-400 hover:text-neutral-700 rounded-lg"><X className="w-4 h-4" /></button>
        </div>

        {!rows && (
          <div
            className="flex-1 overflow-y-auto px-6 py-5 space-y-3"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const f = e.dataTransfer.files?.[0];
              if (f) readFile(f);
            }}
          >
            <textarea
              autoFocus
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={`Paste here (Ctrl+V works for screenshots too). One ${L.one} per line, for example:\n\n${PLACEHOLDER[kind]}`}
              rows={12}
              className="w-full text-sm text-neutral-800 bg-neutral-50 rounded-2xl border border-neutral-200 p-4 outline-none focus:border-neutral-400 resize-y font-mono"
            />
            <div className="flex items-center gap-2 flex-wrap">
              <input ref={fileRef} type="file" accept={ACCEPT} className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) readFile(f); }} />
              <button onClick={() => fileRef.current?.click()} className="flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-xl border border-neutral-200 hover:bg-neutral-50">
                <Upload className="w-3.5 h-3.5" /> Choose file
              </button>
              <span className="text-[11px] text-neutral-400">Word (.docx), PDF, picture, Excel, text. Or drag it onto this window.</span>
            </div>
            {kind === "rocks" && (
              <p className="text-[11px] text-neutral-400">Indented or sub-bullet lines under a rock become its milestones. Dates in a line become due dates.</p>
            )}
            {team.length > 0 && <p className="text-[11px] text-neutral-400">Teammate names in a line ("- Janet", "(Matt)", "@Bobby") are set as the {L.owner.toLowerCase()}.</p>}
            {busy && <p className="text-xs text-neutral-600 flex items-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin" /> {busy}</p>}
            {error && <p className="text-xs text-red-600">{error}</p>}
          </div>
        )}

        {rows && (
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2">
            {rows.map((r) => (
              <div key={r.key} className={`rounded-2xl border p-3 ${r.include ? "border-neutral-200 bg-neutral-50" : "border-neutral-100 bg-white opacity-60"}`}>
                <div className="flex items-start gap-2">
                  <input type="checkbox" checked={r.include} onChange={(e) => update(r.key, "include", e.target.checked)} className="mt-2" />
                  <div className="flex-1 space-y-1.5">
                    <input value={r.title} onChange={(e) => update(r.key, "title", e.target.value)} className={`${input} text-sm font-semibold`} />
                    {kind !== "rocks" && (
                      <input value={r.description} onChange={(e) => update(r.key, "description", e.target.value)} placeholder="Description (optional)" className={input} />
                    )}
                    <div className="flex gap-2">
                      <TeamSelect team={team} value={r.owner} emptyLabel={kind === "todos" ? "Unassigned" : "No owner"} onChange={(v) => update(r.key, "owner", v)} className={input} />
                      {kind === "rocks" && (
                        <input type="date" value={r.due_date} onChange={(e) => update(r.key, "due_date", e.target.value)} className={`${input} w-40`} title="Due date" />
                      )}
                    </div>
                    {kind === "rocks" && (
                      <textarea
                        value={r.milestonesText}
                        onChange={(e) => update(r.key, "milestonesText", e.target.value)}
                        rows={Math.max(2, (r.milestonesText || "").split("\n").length)}
                        placeholder="Milestones, one per line (optional). Add a due date after |, e.g. Map fields | 2026-12-05"
                        className={`${input} font-mono`}
                      />
                    )}
                    {r.duplicate && <p className="text-[11px] text-amber-600">Already on the list. Tick it to add it anyway.</p>}
                  </div>
                  <button onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))} className="p-1.5 text-neutral-300 hover:text-red-400" title="Remove"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>
            ))}
            <button
              onClick={() => setRows((rs) => [...rs, { key: Date.now(), title: "", description: "", owner: "", due_date: "", milestonesText: "", include: true }])}
              className="w-full flex items-center justify-center gap-1 py-2 text-xs text-neutral-400 border-2 border-dashed border-neutral-200 rounded-2xl hover:text-neutral-600"
            >
              <Plus className="w-3.5 h-3.5" /> Add a row
            </button>
            {error && <p className="text-xs text-red-600">{error}</p>}
          </div>
        )}

        <div className="flex items-center justify-between px-6 py-4 border-t border-neutral-100">
          {rows ? (
            <button onClick={() => setRows(null)} className="flex items-center gap-1 text-xs text-neutral-500 hover:text-neutral-800"><ArrowLeft className="w-3.5 h-3.5" /> Back to text</button>
          ) : <span />}
          {rows ? (
            <button onClick={doImport} disabled={!chosen.length || saving}
              className="px-5 py-2.5 bg-neutral-900 text-white text-sm font-semibold rounded-xl hover:bg-neutral-700 disabled:opacity-40">
              {saving ? "Adding…" : `Add ${chosen.length} ${chosen.length === 1 ? L.one : L.many}`}
            </button>
          ) : (
            <button onClick={find} disabled={!text.trim() || !!busy}
              className="px-5 py-2.5 bg-neutral-900 text-white text-sm font-semibold rounded-xl hover:bg-neutral-700 disabled:opacity-40">
              Find {L.many}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

