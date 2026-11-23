// Past meetings for one agenda: date, length, what got done, and the notes taken.
import { useState } from "react";
import { History, X, Clock, CheckCircle2, AlertCircle, ListTodo, ChevronDown } from "lucide-react";

const fmt = (iso) => {
  if (!iso) return "";
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
};
const time = (iso) => (iso ? new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : "");
const mins = (s) => ((s || 0) < 60 ? "under 1 min" : `${Math.round(s / 60)} min`);

export default function MeetingHistory({ agenda, onClose }) {
  const history = agenda.meeting_history || (agenda.last_meeting ? [agenda.last_meeting] : []);
  const [open, setOpen] = useState(history[0]?.id || null);

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-3xl w-full max-w-lg max-h-[85vh] flex flex-col shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-5 border-b border-neutral-100">
          <div>
            <h2 className="text-lg font-bold text-neutral-900 flex items-center gap-2"><History className="w-4 h-4 text-neutral-400" /> Past meetings</h2>
            <p className="text-xs text-neutral-400 truncate max-w-xs">{agenda.title}</p>
          </div>
          <button onClick={onClose} className="p-2 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 rounded-xl"><X className="w-4 h-4" /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2">
          {!history.length && (
            <p className="text-sm text-neutral-400 text-center py-10">
              No meetings recorded yet. A meeting is saved here when you finish it, or leave after at least a minute.
            </p>
          )}
          {history.map((m) => (
            <div key={m.id || m.ended_at} className="rounded-2xl border border-neutral-200">
              <button onClick={() => setOpen(open === m.id ? null : m.id)} className="w-full flex items-center gap-3 p-4 text-left">
                <div className="flex-1">
                  <p className="text-sm font-semibold text-neutral-900">
                    {fmt(m.date)}
                    {m.ended_early && <span className="ml-2 text-[10px] font-semibold uppercase tracking-wider text-amber-600">Ended early</span>}
                  </p>
                  <p className="text-xs text-neutral-500 mt-0.5 flex flex-wrap gap-x-3">
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {mins(m.duration_seconds)}{m.planned_minutes ? ` of ${m.planned_minutes} planned` : ""}</span>
                    <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> {m.items_completed}/{m.items_total} items</span>
                    {m.issues_solved > 0 && <span className="flex items-center gap-1 text-orange-600"><AlertCircle className="w-3 h-3" /> {m.issues_solved} solved</span>}
                    {(m.todos_added > 0 || m.todos_completed > 0) && (
                      <span className="flex items-center gap-1 text-blue-600"><ListTodo className="w-3 h-3" /> +{m.todos_added || 0} / {m.todos_completed || 0} done</span>
                    )}
                  </p>
                </div>
                <ChevronDown className={`w-4 h-4 text-neutral-300 transition-transform ${open === m.id ? "rotate-180" : ""}`} />
              </button>
              {open === m.id && (
                <div className="px-4 pb-4 text-xs text-neutral-600 space-y-1.5 border-t border-neutral-100 pt-3">
                  <p className="text-neutral-400">
                    {time(m.started_at)}–{time(m.ended_at)}{m.run_by ? ` · run by ${m.run_by}` : ""}
                  </p>
                  {m.notes ? <p className="whitespace-pre-wrap leading-relaxed">{m.notes}</p> : <p className="text-neutral-400">No notes were taken.</p>}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
