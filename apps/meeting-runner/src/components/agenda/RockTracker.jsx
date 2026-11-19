import { useState, useRef } from "react";
import TeamSelect from "./TeamSelect";
import { api as base44 } from "@/api/m365";
import { Plus, Trash2, ChevronDown, ChevronUp, X, CheckCircle2, Pencil, Wand2 } from "lucide-react";
import QuickImport from "./QuickImport";

const genId = () => Math.random().toString(36).slice(2, 9);

const emptyForm = () => ({
  title: "", owner: "", start_date: "", due_date: "", on_track: true,
});

// Rocks with done:true are treated as completed (soft-hidden like deleted)

const emptyMilestone = () => ({ title: "", due_date: "" });

function RockCard({ rock, onDelete, onUpdate, onComplete, team = [] }) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ title: rock.title, owner: rock.owner || "", start_date: rock.start_date || "", due_date: rock.due_date || "" });
  const [milestoneForm, setMilestoneForm] = useState(emptyMilestone());
  const [showMilestoneForm, setShowMilestoneForm] = useState(false);
  const [editingMilestoneId, setEditingMilestoneId] = useState(null);
  const [editMilestoneForm, setEditMilestoneForm] = useState({ title: "", due_date: "" });

  const toggleOnTrack = () => onUpdate({ ...rock, on_track: !rock.on_track });

  const saveEdit = () => {
    if (!editForm.title.trim()) return;
    onUpdate({ ...rock, title: editForm.title.trim(), owner: editForm.owner.trim(), start_date: editForm.start_date, due_date: editForm.due_date });
    setEditing(false);
  };

  const addMilestone = () => {
    if (!milestoneForm.title.trim()) return;
    const milestone = { id: genId(), title: milestoneForm.title.trim(), due_date: milestoneForm.due_date, done: false };
    onUpdate({ ...rock, milestones: [...(rock.milestones || []), milestone] });
    setMilestoneForm(emptyMilestone());
    setShowMilestoneForm(false);
  };

  const toggleMilestoneDone = (id) => {
    const updated = (rock.milestones || []).map((m) =>
      m.id === id ? { ...m, done: !m.done } : m
    );
    onUpdate({ ...rock, milestones: updated });
  };

  const deleteMilestone = (id) => {
    onUpdate({ ...rock, milestones: (rock.milestones || []).filter((m) => m.id !== id) });
  };

  const startEditMilestone = (m) => {
    setEditingMilestoneId(m.id);
    setEditMilestoneForm({ title: m.title, due_date: m.due_date || "" });
  };

  const saveEditMilestone = (id) => {
    if (!editMilestoneForm.title.trim()) return;
    const updated = (rock.milestones || []).map((m) =>
      m.id === id ? { ...m, title: editMilestoneForm.title.trim(), due_date: editMilestoneForm.due_date } : m
    );
    onUpdate({ ...rock, milestones: updated });
    setEditingMilestoneId(null);
  };

  return (
    <div className="bg-neutral-50 rounded-2xl border border-neutral-100 overflow-hidden">
      <div className="p-3">
        {editing ? (
          <div className="space-y-1.5">
            <input
              autoFocus
              value={editForm.title}
              onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))}
              onKeyDown={(e) => e.key === "Enter" && saveEdit()}
              className="w-full text-sm font-semibold text-neutral-800 bg-white rounded-lg border border-neutral-200 px-2 py-1 outline-none"
            />
            <TeamSelect team={team} value={editForm.owner}
              onChange={(v) => setEditForm((f) => ({ ...f, owner: v }))} />
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-neutral-400 uppercase tracking-wider">Start Date</label>
                <input type="date" value={editForm.start_date}
                  onChange={(e) => setEditForm((f) => ({ ...f, start_date: e.target.value }))}
                  className="w-full text-xs text-neutral-600 bg-white rounded-lg border border-neutral-200 px-2 py-1 outline-none mt-0.5"
                />
              </div>
              <div>
                <label className="text-[10px] text-neutral-400 uppercase tracking-wider">Due Date</label>
                <input type="date" value={editForm.due_date}
                  onChange={(e) => setEditForm((f) => ({ ...f, due_date: e.target.value }))}
                  className="w-full text-xs text-neutral-600 bg-white rounded-lg border border-neutral-200 px-2 py-1 outline-none mt-0.5"
                />
              </div>
            </div>
            <div className="flex gap-2 pt-0.5">
              <button onClick={saveEdit} disabled={!editForm.title.trim()}
                className="px-3 py-1 bg-neutral-900 text-white text-[10px] font-semibold rounded-lg hover:bg-neutral-700 disabled:opacity-40 transition-colors">
                Save
              </button>
              <button onClick={() => setEditing(false)}
                className="px-3 py-1 text-[10px] text-neutral-400 hover:text-neutral-700 transition-colors">
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-neutral-800 leading-snug">{rock.title}</p>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1">
                {rock.owner && <span className="text-xs text-neutral-400">{rock.owner}</span>}
                {rock.start_date && <span className="text-xs text-neutral-300">{rock.start_date}</span>}
                {rock.due_date && <span className="text-xs text-neutral-400">→ {rock.due_date}</span>}
              </div>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <button
                onClick={toggleOnTrack}
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full transition-colors ${
                  rock.on_track
                    ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                    : "bg-red-100 text-red-600 hover:bg-red-200"
                }`}
              >
                {rock.on_track ? "On Track" : "Off Track"}
              </button>
              <button
                onClick={() => onComplete(rock.id)}
                className="p-1 text-neutral-300 hover:text-emerald-500 hover:bg-emerald-50 rounded-lg transition-colors"
                title="Mark complete"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => { setEditing(true); setExpanded(true); }}
                className="p-1 text-neutral-300 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                title="Edit"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setExpanded((v) => !v)}
                className="p-1 text-neutral-300 hover:text-neutral-500 rounded-lg transition-colors"
              >
                {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              <button
                onClick={() => onDelete(rock.id)}
                className="p-1 text-neutral-300 hover:text-red-400 hover:bg-red-50 rounded-lg transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {expanded && (
        <div className="border-t border-neutral-100 px-3 pb-3 pt-2">
          <p className="text-[10px] font-semibold tracking-widest text-neutral-400 uppercase mb-2">Milestones</p>
          <div className="space-y-1.5">
            {(rock.milestones || []).length === 0 && !showMilestoneForm && (
              <p className="text-xs text-neutral-300">No milestones yet.</p>
            )}
            {(rock.milestones || []).map((m) => (
              <div key={m.id} className="group">
                {editingMilestoneId === m.id ? (
                  <div className="flex items-center gap-2 bg-white rounded-lg border border-neutral-200 px-2 py-1">
                    <input
                      autoFocus
                      value={editMilestoneForm.title}
                      onChange={(e) => setEditMilestoneForm((f) => ({ ...f, title: e.target.value }))}
                      onKeyDown={(e) => e.key === "Enter" && saveEditMilestone(m.id)}
                      className="flex-1 text-xs text-neutral-800 bg-transparent outline-none"
                    />
                    <input
                      type="date"
                      value={editMilestoneForm.due_date}
                      onChange={(e) => setEditMilestoneForm((f) => ({ ...f, due_date: e.target.value }))}
                      className="text-[10px] text-neutral-400 bg-transparent outline-none"
                    />
                    <button onClick={() => saveEditMilestone(m.id)} className="text-[10px] text-emerald-600 font-semibold hover:text-emerald-700">Save</button>
                    <button onClick={() => setEditingMilestoneId(null)} className="text-[10px] text-neutral-400 hover:text-neutral-600">✕</button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <button onClick={() => toggleMilestoneDone(m.id)} className="flex-shrink-0">
                      <CheckCircle2 className={`w-3.5 h-3.5 ${m.done ? "text-emerald-500" : "text-neutral-300"}`} />
                    </button>
                    <span className={`text-xs flex-1 ${m.done ? "line-through text-neutral-300" : "text-neutral-600"}`}>{m.title}</span>
                    {m.due_date && <span className="text-[10px] text-neutral-300">{m.due_date}</span>}
                    <button onClick={() => startEditMilestone(m)} className="opacity-0 group-hover:opacity-100 p-0.5 text-neutral-300 hover:text-blue-400 transition-all">
                      <Pencil className="w-3 h-3" />
                    </button>
                    <button onClick={() => deleteMilestone(m.id)} className="opacity-0 group-hover:opacity-100 p-0.5 text-neutral-300 hover:text-red-400 transition-all">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {showMilestoneForm && (
            <div className="mt-2 space-y-1.5 bg-white rounded-xl border border-neutral-200 p-2.5">
              <input
                autoFocus
                type="text"
                placeholder="Milestone title *"
                value={milestoneForm.title}
                onChange={(e) => setMilestoneForm((f) => ({ ...f, title: e.target.value }))}
                onKeyDown={(e) => e.key === "Enter" && addMilestone()}
                className="w-full text-xs text-neutral-800 placeholder:text-neutral-300 bg-transparent outline-none border-b border-neutral-100 pb-1"
              />
              <input
                type="date"
                value={milestoneForm.due_date}
                onChange={(e) => setMilestoneForm((f) => ({ ...f, due_date: e.target.value }))}
                className="w-full text-xs text-neutral-500 bg-transparent outline-none"
              />
              <div className="flex gap-2 pt-0.5">
                <button onClick={addMilestone} disabled={!milestoneForm.title.trim()}
                  className="px-3 py-1 bg-neutral-900 text-white text-[10px] font-semibold rounded-lg hover:bg-neutral-700 disabled:opacity-40 transition-colors">
                  Add
                </button>
                <button onClick={() => { setShowMilestoneForm(false); setMilestoneForm(emptyMilestone()); }}
                  className="px-3 py-1 text-[10px] text-neutral-400 hover:text-neutral-700 transition-colors">
                  Cancel
                </button>
              </div>
            </div>
          )}

          {!showMilestoneForm && (
            <button
              onClick={() => setShowMilestoneForm(true)}
              className="mt-2 flex items-center gap-1 text-[10px] text-neutral-400 hover:text-neutral-600 transition-colors"
            >
              <Plus className="w-3 h-3" /> Add Milestone
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function RockTracker({ agenda, onClose }) {
  // Latest saved copy of the agenda, so each save builds on the previous one
  const latest = useRef(agenda);
  const [rocks, setRocks] = useState(
    (latest.current.rocks || []).filter((r) => !r.deleted && !r.done)
  );
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [form, setForm] = useState(emptyForm());

  const persist = async (updated) => {
    setSaving(true);
    const deleted = (latest.current.rocks || []).filter((r) => r.deleted);
    latest.current = await base44.entities.Agenda.update(agenda.id, {
      rocks: [...deleted, ...updated],
    });
    setSaving(false);
  };

  const handleAdd = async () => {
    if (!form.title.trim()) return;
    const newRock = {
      id: genId(),
      title: form.title.trim(),
      owner: form.owner.trim(),
      start_date: form.start_date,
      due_date: form.due_date,
      on_track: form.on_track,
      deleted: false,
      milestones: [],
    };
    const updated = [...rocks, newRock];
    setRocks(updated);
    setForm(emptyForm());
    setShowForm(false);
    await persist(updated);
  };

  const handleImport = async (found) => {
    const added = found.map((x) => ({
      id: genId(),
      title: x.title,
      owner: x.owner || "",
      start_date: "",
      due_date: x.due_date || "",
      on_track: true,
      deleted: false,
      milestones: (x.milestones || []).map((m) => ({ id: genId(), title: m.title, due_date: m.due_date || "", done: false })),
    }));
    const updated = [...rocks, ...added];
    setRocks(updated);
    await persist(updated);
  };

  const handleDelete = async (id) => {
    const target = rocks.find((r) => r.id === id);
    const updated = rocks.filter((r) => r.id !== id);
    setRocks(updated);
    setSaving(true);
    const existing = latest.current.rocks || [];
    const others = existing.filter((r) => r.id !== id && r.deleted);
    latest.current = await base44.entities.Agenda.update(agenda.id, {
      rocks: [...others, { ...target, deleted: true }, ...updated],
    });
    setSaving(false);
  };

  const handleUpdate = async (updatedRock) => {
    const updated = rocks.map((r) => r.id === updatedRock.id ? updatedRock : r);
    setRocks(updated);
    await persist(updated);
  };

  const handleComplete = async (id) => {
    const target = rocks.find((r) => r.id === id);
    const updated = rocks.filter((r) => r.id !== id);
    setRocks(updated);
    setSaving(true);
    const existing = (latest.current.rocks || []).filter((r) => r.id !== id);
    latest.current = await base44.entities.Agenda.update(agenda.id, {
      rocks: [...existing, { ...target, done: true }],
    });
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-3xl w-full max-w-lg max-h-[85vh] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-neutral-100">
          <div>
            <h2 className="text-lg font-bold text-neutral-900">Rocks</h2>
            <p className="text-xs text-neutral-400 truncate max-w-xs">{agenda.title}</p>
          </div>
          <div className="flex items-center gap-2">
            {saving && <span className="text-xs text-neutral-400">Saving…</span>}
            <button onClick={onClose} className="p-2 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 rounded-xl transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Rock list */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2">
          {rocks.length === 0 && !showForm && (
            <p className="text-sm text-neutral-400 text-center py-8">No rocks yet. Add one below.</p>
          )}

          {rocks.map((rock) => (
            <RockCard key={rock.id} rock={rock} onDelete={handleDelete} onUpdate={handleUpdate} onComplete={handleComplete} team={agenda.team || []} />
          ))}

          {/* Add form */}
          {showForm && (
            <div className="bg-neutral-50 rounded-2xl border border-neutral-200 p-4 space-y-2">
              <input
                autoFocus
                type="text"
                placeholder="Rock title *"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                className="w-full text-sm font-semibold text-neutral-800 placeholder:text-neutral-300 bg-transparent outline-none border-b border-neutral-200 pb-1"
              />
              <TeamSelect team={agenda.team || []} value={form.owner}
                onChange={(v) => setForm((f) => ({ ...f, owner: v }))} />
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-neutral-400 uppercase tracking-wider">Start Date</label>
                  <input
                    type="date"
                    value={form.start_date}
                    onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))}
                    className="w-full text-xs text-neutral-600 bg-transparent outline-none mt-0.5"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-neutral-400 uppercase tracking-wider">Due Date</label>
                  <input
                    type="date"
                    value={form.due_date}
                    onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))}
                    className="w-full text-xs text-neutral-600 bg-transparent outline-none mt-0.5"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, on_track: true }))}
                  className={`px-3 py-1 text-xs font-semibold rounded-full transition-colors ${form.on_track ? "bg-emerald-100 text-emerald-700" : "bg-neutral-100 text-neutral-400"}`}
                >
                  On Track
                </button>
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, on_track: false }))}
                  className={`px-3 py-1 text-xs font-semibold rounded-full transition-colors ${!form.on_track ? "bg-red-100 text-red-600" : "bg-neutral-100 text-neutral-400"}`}
                >
                  Off Track
                </button>
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={handleAdd}
                  disabled={!form.title.trim()}
                  className="px-4 py-1.5 bg-neutral-900 text-white text-xs font-semibold rounded-lg hover:bg-neutral-700 disabled:opacity-40 transition-colors"
                >
                  Add Rock
                </button>
                <button
                  onClick={() => { setShowForm(false); setForm(emptyForm()); }}
                  className="px-4 py-1.5 text-xs text-neutral-500 hover:text-neutral-800 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {!showForm && (
          <div className="px-6 pb-5 flex gap-2">
            <button
              onClick={() => setShowForm(true)}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 border-2 border-dashed border-neutral-200 rounded-2xl text-sm text-neutral-400 hover:border-neutral-300 hover:text-neutral-600 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Rock
            </button>
            <button
              onClick={() => setShowImport(true)}
              title="Paste notes, a screenshot or a document"
              className="flex items-center justify-center gap-2 px-4 py-2.5 border-2 border-dashed border-neutral-200 rounded-2xl text-sm text-neutral-400 hover:border-neutral-300 hover:text-neutral-600 transition-colors"
            >
              <Wand2 className="w-4 h-4" />
              Quick Import
            </button>
          </div>
        )}
      </div>
      {showImport && (
        <QuickImport kind="rocks" team={agenda.team || []} existing={rocks.map((x) => x.title)}
          onImport={handleImport} onClose={() => setShowImport(false)} />
      )}
    </div>
  );
}