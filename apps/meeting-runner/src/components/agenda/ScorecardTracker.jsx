import { useState, useRef } from "react";
import { api as base44 } from "@/api/m365";
import { Target, Plus, Trash2, Pencil, X, TrendingUp, TrendingDown } from "lucide-react";

const genId = () => Math.random().toString(36).slice(2, 9);
const todayStr = () => new Date().toISOString().split("T")[0];

const emptyMetric = () => ({
  name: "",
  description: "",
  target: "",
  unit: "",
  owner: "",
  higher_is_better: true,
});

function latestEntry(history = []) {
  if (!history.length) return null;
  return [...history].sort((a, b) => (a.date < b.date ? 1 : -1))[0];
}

function isOnTrack(metric) {
  const latest = latestEntry(metric.history);
  if (!latest) return null;
  const met = metric.higher_is_better
    ? latest.value >= metric.target
    : latest.value <= metric.target;
  return met;
}

function MetricCard({ metric, onDelete, onUpdate, team }) {
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    name: metric.name,
    description: metric.description || "",
    target: String(metric.target),
    unit: metric.unit || "",
    owner: metric.owner || "",
    higher_is_better: metric.higher_is_better !== false,
  });
  const [showLog, setShowLog] = useState(false);
  const [logForm, setLogForm] = useState({ date: todayStr(), value: "" });

  const onTrack = isOnTrack(metric);
  const latest = latestEntry(metric.history);
  const sortedHistory = [...(metric.history || [])].sort((a, b) => (a.date < b.date ? 1 : -1));

  const saveEdit = () => {
    if (!editForm.name.trim()) return;
    onUpdate({
      ...metric,
      name: editForm.name.trim(),
      description: editForm.description.trim(),
      target: Number(editForm.target) || 0,
      unit: editForm.unit.trim(),
      owner: editForm.owner,
      higher_is_better: editForm.higher_is_better,
    });
    setEditing(false);
  };

  const addLog = () => {
    if (logForm.value === "" || isNaN(Number(logForm.value))) return;
    const entry = { id: genId(), date: logForm.date, value: Number(logForm.value) };
    onUpdate({ ...metric, history: [...(metric.history || []), entry] });
    setLogForm({ date: todayStr(), value: "" });
    setShowLog(false);
  };

  const deleteLog = (id) => {
    onUpdate({ ...metric, history: (metric.history || []).filter((h) => h.id !== id) });
  };

  return (
    <div className={`rounded-2xl border p-4 transition-all ${onTrack === false ? "bg-red-50 border-red-200" : onTrack === true ? "bg-emerald-50 border-emerald-200" : "bg-neutral-50 border-neutral-100"}`}>
      {editing ? (
        <div className="space-y-2">
          <input autoFocus value={editForm.name}
            onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="Metric name *"
            className="w-full text-sm font-semibold text-neutral-800 bg-white rounded-lg border border-neutral-200 px-2 py-1.5 outline-none"
          />
          <input value={editForm.description}
            onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
            placeholder="Description"
            className="w-full text-xs text-neutral-600 bg-white rounded-lg border border-neutral-200 px-2 py-1 outline-none"
          />
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-neutral-400 uppercase tracking-wider">Target</label>
              <input type="number" value={editForm.target}
                onChange={(e) => setEditForm((f) => ({ ...f, target: e.target.value }))}
                className="w-full text-xs text-neutral-700 bg-white rounded-lg border border-neutral-200 px-2 py-1 outline-none mt-0.5"
              />
            </div>
            <div>
              <label className="text-[10px] text-neutral-400 uppercase tracking-wider">Unit</label>
              <input value={editForm.unit}
                onChange={(e) => setEditForm((f) => ({ ...f, unit: e.target.value }))}
                placeholder="$, %, etc."
                className="w-full text-xs text-neutral-700 bg-white rounded-lg border border-neutral-200 px-2 py-1 outline-none mt-0.5"
              />
            </div>
          </div>
          <div>
            <label className="text-[10px] text-neutral-400 uppercase tracking-wider">Owner</label>
            <select value={editForm.owner}
              onChange={(e) => setEditForm((f) => ({ ...f, owner: e.target.value }))}
              className="w-full text-xs text-neutral-700 bg-white rounded-lg border border-neutral-200 px-2 py-1.5 outline-none mt-0.5">
              <option value="">No owner</option>
              {team.map((m) => (
                <option key={m.id} value={`${m.first_name} ${m.last_name}`.trim()}>
                  {m.first_name} {m.last_name}{m.title ? ` — ${m.title}` : ""}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => setEditForm((f) => ({ ...f, higher_is_better: true }))}
              className={`flex-1 flex items-center justify-center gap-1 px-2 py-1 text-[11px] font-semibold rounded-lg ${editForm.higher_is_better ? "bg-emerald-100 text-emerald-700" : "bg-neutral-100 text-neutral-400"}`}>
              <TrendingUp className="w-3 h-3" /> Higher is better
            </button>
            <button type="button" onClick={() => setEditForm((f) => ({ ...f, higher_is_better: false }))}
              className={`flex-1 flex items-center justify-center gap-1 px-2 py-1 text-[11px] font-semibold rounded-lg ${!editForm.higher_is_better ? "bg-emerald-100 text-emerald-700" : "bg-neutral-100 text-neutral-400"}`}>
              <TrendingDown className="w-3 h-3" /> Lower is better
            </button>
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={saveEdit} disabled={!editForm.name.trim()}
              className="px-3 py-1 bg-neutral-900 text-white text-xs font-semibold rounded-lg disabled:opacity-40 hover:bg-neutral-700 transition-colors">Save</button>
            <button onClick={() => setEditing(false)}
              className="px-3 py-1 text-xs text-neutral-400 hover:text-neutral-700">Cancel</button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-start gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-neutral-800 leading-snug">{metric.name}</p>
                {onTrack === false && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-200 text-red-700">Off Track</span>}
                {onTrack === true && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-200 text-emerald-700">On Track</span>}
              </div>
              {metric.description && <p className="text-xs text-neutral-500 mt-0.5 leading-snug">{metric.description}</p>}
              {metric.owner && <p className="text-[11px] text-neutral-400 mt-0.5">Owner: {metric.owner}</p>}
              <div className="flex items-center gap-3 mt-1.5">
                <span className="text-xs text-neutral-400">Target: <span className="font-semibold text-neutral-600">{metric.target}{metric.unit ? ` ${metric.unit}` : ""}</span></span>
                {latest && (
                  <span className={`text-xs font-semibold ${onTrack === false ? "text-red-600" : onTrack === true ? "text-emerald-600" : "text-neutral-500"}`}>
                    Latest: {latest.value}{metric.unit ? ` ${metric.unit}` : ""}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <button onClick={() => setShowLog((v) => !v)} title="Log weekly value"
                className="p-1.5 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 rounded-lg transition-colors">
                <Plus className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => setEditing(true)} title="Edit"
                className="p-1.5 text-neutral-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors">
                <Pencil className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => onDelete(metric.id)} title="Delete"
                className="p-1.5 text-neutral-400 hover:text-red-400 hover:bg-red-50 rounded-lg transition-colors">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {showLog && (
            <div className="mt-3 bg-white rounded-xl border border-neutral-200 p-3 space-y-2">
              <p className="text-[10px] font-semibold tracking-widest text-neutral-400 uppercase">Log weekly value</p>
              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <label className="text-[10px] text-neutral-400">Date</label>
                  <input type="date" value={logForm.date}
                    onChange={(e) => setLogForm((f) => ({ ...f, date: e.target.value }))}
                    className="w-full text-xs text-neutral-700 bg-neutral-50 rounded-lg border border-neutral-200 px-2 py-1 outline-none mt-0.5"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-[10px] text-neutral-400">Value {metric.unit ? `(${metric.unit})` : ""}</label>
                  <input type="number" value={logForm.value}
                    onChange={(e) => setLogForm((f) => ({ ...f, value: e.target.value }))}
                    onKeyDown={(e) => e.key === "Enter" && addLog()}
                    className="w-full text-xs text-neutral-700 bg-neutral-50 rounded-lg border border-neutral-200 px-2 py-1 outline-none mt-0.5"
                  />
                </div>
                <button onClick={addLog} disabled={logForm.value === ""}
                  className="px-3 py-1.5 bg-neutral-900 text-white text-xs font-semibold rounded-lg disabled:opacity-40 hover:bg-neutral-700 transition-colors">Add</button>
              </div>
            </div>
          )}

          {sortedHistory.length > 0 && (
            <div className="mt-3 pt-2 border-t border-neutral-200/60">
              <p className="text-[10px] font-semibold tracking-widest text-neutral-400 uppercase mb-1.5">Weekly History</p>
              <div className="space-y-1">
                {sortedHistory.slice(0, 8).map((h) => {
                  const met = metric.higher_is_better ? h.value >= metric.target : h.value <= metric.target;
                  return (
                    <div key={h.id} className="flex items-center gap-2 group">
                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${met ? "bg-emerald-500" : "bg-red-500"}`} />
                      <span className="text-xs text-neutral-500 w-24">{h.date}</span>
                      <span className={`text-xs font-semibold ${met ? "text-emerald-600" : "text-red-600"}`}>{h.value}{metric.unit ? ` ${metric.unit}` : ""}</span>
                      <span className="text-[10px] text-neutral-300 ml-auto">{met ? "✓" : "below target"}</span>
                      <button onClick={() => deleteLog(h.id)} className="opacity-0 group-hover:opacity-100 text-neutral-300 hover:text-red-400 transition-all">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function ScorecardTracker({ agenda, onClose }) {
  // Latest saved copy of the agenda, so each save builds on the previous one
  const latest = useRef(agenda);
  const [metrics, setMetrics] = useState(latest.current.scorecard || []);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyMetric());

  const persist = async (updated) => {
    setSaving(true);
    latest.current = await base44.entities.Agenda.update(agenda.id, { scorecard: updated });
    setSaving(false);
  };

  const handleAdd = async () => {
    if (!form.name.trim()) return;
    const newMetric = {
      id: genId(),
      name: form.name.trim(),
      description: form.description.trim(),
      target: Number(form.target) || 0,
      unit: form.unit.trim(),
      owner: form.owner,
      higher_is_better: form.higher_is_better,
      history: [],
    };
    const updated = [...metrics, newMetric];
    setMetrics(updated);
    setForm(emptyMetric());
    setShowForm(false);
    await persist(updated);
  };

  const handleUpdate = async (updatedMetric) => {
    const updated = metrics.map((m) => (m.id === updatedMetric.id ? updatedMetric : m));
    setMetrics(updated);
    await persist(updated);
  };

  const handleDelete = async (id) => {
    const updated = metrics.filter((m) => m.id !== id);
    setMetrics(updated);
    await persist(updated);
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-3xl w-full max-w-lg max-h-[85vh] flex flex-col shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-5 border-b border-neutral-100">
          <div>
            <h2 className="text-lg font-bold text-neutral-900 flex items-center gap-2">
              <Target className="w-4 h-4 text-neutral-400" /> Scorecard
            </h2>
            <p className="text-xs text-neutral-400 truncate max-w-xs">{agenda.title}</p>
          </div>
          <div className="flex items-center gap-2">
            {saving && <span className="text-xs text-neutral-400">Saving…</span>}
            <button onClick={onClose} className="p-2 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 rounded-xl transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
          {metrics.length === 0 && !showForm && (
            <p className="text-sm text-neutral-400 text-center py-8">No metrics yet. Add one below.</p>
          )}

          {metrics.map((metric) => (
            <MetricCard key={metric.id} metric={metric} onDelete={handleDelete} onUpdate={handleUpdate} team={agenda.team || []} />
          ))}

          {showForm && (
            <div className="bg-neutral-50 rounded-2xl border border-neutral-200 p-4 space-y-2">
              <input autoFocus type="text" placeholder="Metric name *" value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="w-full text-sm font-semibold text-neutral-800 placeholder:text-neutral-300 bg-transparent outline-none border-b border-neutral-200 pb-1"
              />
              <textarea placeholder="Description (optional)" value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                rows={2}
                className="w-full text-xs text-neutral-600 placeholder:text-neutral-300 bg-transparent outline-none resize-none"
              />
              <div className="grid grid-cols-2 gap-2">
                <input type="number" placeholder="Target *" value={form.target}
                  onChange={(e) => setForm((f) => ({ ...f, target: e.target.value }))}
                  className="text-xs text-neutral-700 placeholder:text-neutral-300 bg-white rounded-lg border border-neutral-200 px-2 py-1 outline-none"
                />
                <input type="text" placeholder="Unit ($, %, etc.)" value={form.unit}
                  onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
                  className="text-xs text-neutral-700 placeholder:text-neutral-300 bg-white rounded-lg border border-neutral-200 px-2 py-1 outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] text-neutral-400 uppercase tracking-wider">Owner</label>
                <select value={form.owner}
                  onChange={(e) => setForm((f) => ({ ...f, owner: e.target.value }))}
                  className="w-full text-xs text-neutral-700 bg-white rounded-lg border border-neutral-200 px-2 py-1.5 outline-none mt-0.5">
                  <option value="">No owner</option>
                  {(agenda.team || []).map((m) => (
                    <option key={m.id} value={`${m.first_name} ${m.last_name}`.trim()}>
                      {m.first_name} {m.last_name}{m.title ? ` — ${m.title}` : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => setForm((f) => ({ ...f, higher_is_better: true }))}
                  className={`flex-1 flex items-center justify-center gap-1 px-2 py-1 text-[11px] font-semibold rounded-lg ${form.higher_is_better ? "bg-emerald-100 text-emerald-700" : "bg-neutral-100 text-neutral-400"}`}>
                  <TrendingUp className="w-3 h-3" /> Higher is better
                </button>
                <button type="button" onClick={() => setForm((f) => ({ ...f, higher_is_better: false }))}
                  className={`flex-1 flex items-center justify-center gap-1 px-2 py-1 text-[11px] font-semibold rounded-lg ${!form.higher_is_better ? "bg-emerald-100 text-emerald-700" : "bg-neutral-100 text-neutral-400"}`}>
                  <TrendingDown className="w-3 h-3" /> Lower is better
                </button>
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={handleAdd} disabled={!form.name.trim()}
                  className="px-4 py-1.5 bg-neutral-900 text-white text-xs font-semibold rounded-lg disabled:opacity-40 hover:bg-neutral-700 transition-colors">Add Metric</button>
                <button onClick={() => { setShowForm(false); setForm(emptyMetric()); }}
                  className="px-4 py-1.5 text-xs text-neutral-500 hover:text-neutral-800 transition-colors">Cancel</button>
              </div>
            </div>
          )}
        </div>

        {!showForm && (
          <div className="px-6 pb-5">
            <button onClick={() => setShowForm(true)}
              className="w-full flex items-center justify-center gap-2 py-2.5 border-2 border-dashed border-neutral-200 rounded-2xl text-sm text-neutral-400 hover:border-neutral-300 hover:text-neutral-600 transition-colors">
              <Plus className="w-4 h-4" /> Add Metric
            </button>
          </div>
        )}
      </div>
    </div>
  );
}