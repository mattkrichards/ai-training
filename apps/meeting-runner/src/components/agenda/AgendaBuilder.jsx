import { useEffect, useState } from "react";
import { api as base44 } from "@/api/m365";
import TeamSelect from "./TeamSelect";
import AgendaImport from "./AgendaImport";
import { ArrowLeft, Plus, GripVertical, Trash2, Save, Clock, Wand2 } from "lucide-react";

const genId = () => Math.random().toString(36).slice(2, 9);

const emptyItem = () => ({
  id: genId(),
  title: "",
  duration: 10,
  presenter: "",
  notes: "",
});

export default function AgendaBuilder({ agenda, onBack, defaultTeamId = "" }) {
  const [title, setTitle] = useState(agenda?.title || "");
  const [items, setItems] = useState(agenda?.items || [emptyItem()]);
  const [saving, setSaving] = useState(false);
  const [dragIdx, setDragIdx] = useState(null);
  const [overIdx, setOverIdx] = useState(null);
  const [showImport, setShowImport] = useState(false);
  const [teams, setTeams] = useState([]);
  const [teamId, setTeamId] = useState(agenda?.team_id || defaultTeamId || "");

  useEffect(() => {
    base44.entities.Team.list("name").then(setTeams).catch(() => setTeams([]));
  }, []);

  // Presenter choices: the chosen team's members, else the agenda's own list.
  const selectedTeam = teams.find((t) => t.id === teamId);
  const people = selectedTeam ? selectedTeam.members || [] : agenda?.team_id ? [] : agenda?.team || [];

  // Items that are still the blank starter row don't count as "current items".
  const realItems = items.filter((i) => (i.title || "").trim());

  const applyImport = ({ title: importedTitle, mode, items: imported }) => {
    const made = imported.map((it) => ({ ...emptyItem(), ...it }));
    setItems(mode === "append" ? [...realItems, ...made] : made);
    if (importedTitle && !title.trim()) setTitle(importedTitle);
    else if (importedTitle && mode === "replace") setTitle(importedTitle);
  };

  const totalMins = items.reduce((sum, i) => sum + (Number(i.duration) || 0), 0);

  const addItem = () => setItems((prev) => [...prev, emptyItem()]);

  const updateItem = (idx, field, value) => {
    setItems((prev) => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item));
  };

  const removeItem = (idx) => {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleDragStart = (idx) => setDragIdx(idx);
  const handleDragOver = (e, idx) => { e.preventDefault(); setOverIdx(idx); };
  const handleDrop = (idx) => {
    if (dragIdx === null || dragIdx === idx) return;
    const next = [...items];
    const [moved] = next.splice(dragIdx, 1);
    next.splice(idx, 0, moved);
    setItems(next);
    setDragIdx(null);
    setOverIdx(null);
  };

  const handleSave = async () => {
    if (!title.trim()) return;
    setSaving(true);
    const payload = { title: title.trim(), items, team_id: teamId || null };
    // Moving an agenda that has its own member list onto a team: add those people to the
    // team so nobody is lost.
    if (teamId && selectedTeam && !agenda?.team_id && (agenda?.team || []).length) {
      const have = new Set((selectedTeam.members || []).map((m) => `${m.first_name} ${m.last_name}`.trim().toLowerCase()));
      const extra = agenda.team.filter((m) => !have.has(`${m.first_name} ${m.last_name}`.trim().toLowerCase()));
      if (extra.length) await base44.entities.Team.update(teamId, { members: [...(selectedTeam.members || []), ...extra] });
    }
    // Taking an agenda off a team: keep a copy of the members on the agenda.
    if (!teamId && agenda?.team_id) payload.team = agenda.team || [];
    if (agenda?.id) {
      await base44.entities.Agenda.update(agenda.id, payload);
    } else {
      await base44.entities.Agenda.create(payload);
    }
    setSaving(false);
    onBack();
  };

  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      {/* Top bar */}
      <div className="flex items-center justify-between mb-10">
        <button onClick={onBack} className="flex items-center gap-2 text-sm text-neutral-500 hover:text-neutral-900 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
        <div className="flex items-center gap-4">
          <button onClick={() => setShowImport(true)} title="Paste a screenshot, text or document of an agenda"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neutral-600 rounded-xl border border-neutral-200 bg-white hover:bg-neutral-50 transition-colors">
            <Wand2 className="w-3.5 h-3.5" /> Import agenda
          </button>
          <div className="flex items-center gap-2 text-sm text-neutral-400">
            <Clock className="w-4 h-4" />
            <span>{totalMins} min total</span>
          </div>
        </div>
      </div>

      {/* Title */}
      <input
        type="text"
        placeholder="Meeting title…"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="w-full text-3xl font-bold text-neutral-900 placeholder:text-neutral-300 bg-transparent border-none outline-none mb-3 tracking-tight"
      />
      <div className="flex items-center gap-2 mb-10 text-sm text-neutral-500">
        <span>Team</span>
        <select value={teamId} onChange={(e) => setTeamId(e.target.value)}
          className="text-sm text-neutral-800 bg-white border border-neutral-200 rounded-xl px-3 py-1.5 outline-none focus:border-rs-slate">
          <option value="">No team</option>
          {teams.map((t) => <option key={t.id} value={t.id}>{t.name} ({(t.members || []).length})</option>)}
        </select>
        {!teams.length && <span className="text-xs text-neutral-400">Create teams with the Teams button on the home page.</span>}
      </div>

      {!agenda?.id && !realItems.length && (
        <button onClick={() => setShowImport(true)}
          className="w-full mb-4 flex items-center justify-center gap-2 py-3 rounded-2xl border-2 border-dashed border-violet-200 bg-violet-50/50 text-sm text-violet-600 hover:bg-violet-50 transition-colors">
          <Wand2 className="w-4 h-4" /> Have an agenda already? Paste a screenshot or text to import it
        </button>
      )}

      {/* Items */}
      <div className="space-y-2 mb-6">
        {items.map((item, idx) => (
          <div
            key={item.id}
            draggable
            onDragStart={() => handleDragStart(idx)}
            onDragOver={(e) => handleDragOver(e, idx)}
            onDrop={() => handleDrop(idx)}
            className={`bg-white rounded-2xl border transition-all ${
              overIdx === idx && dragIdx !== idx
                ? "border-blue-300 shadow-md scale-[1.01]"
                : "border-neutral-100 hover:border-neutral-200"
            }`}
          >
            <div className="flex items-start gap-3 p-4">
              <div className="mt-3 cursor-grab text-neutral-300 hover:text-neutral-500">
                <GripVertical className="w-4 h-4" />
              </div>
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Agenda item…"
                    value={item.title}
                    onChange={(e) => updateItem(idx, "title", e.target.value)}
                    className="flex-1 text-sm font-semibold text-neutral-800 placeholder:text-neutral-300 bg-transparent outline-none"
                  />
                  <div className="flex items-center gap-1 bg-neutral-50 rounded-lg px-2 py-1">
                    <input
                      type="number"
                      min="1"
                      max="999"
                      value={item.duration}
                      onChange={(e) => updateItem(idx, "duration", e.target.value === "" ? "" : Number(e.target.value))}
                      className="w-10 text-sm font-semibold text-center text-neutral-700 bg-transparent outline-none"
                    />
                    <span className="text-xs text-neutral-400">min</span>
                  </div>
                </div>
                <TeamSelect team={people} value={item.presenter || ""} emptyLabel="No presenter"
                  onChange={(v) => updateItem(idx, "presenter", v)}
                  className="w-full text-xs text-neutral-500 bg-transparent border border-neutral-200 rounded-md px-1.5 py-1 outline-none" />
                <textarea
                  placeholder="Notes (optional)"
                  value={item.notes}
                  onChange={(e) => updateItem(idx, "notes", e.target.value)}
                  rows={1}
                  className="w-full text-xs text-neutral-500 placeholder:text-neutral-300 bg-transparent outline-none resize-none"
                />
              </div>
              <button
                onClick={() => removeItem(idx)}
                className="mt-1 p-1.5 text-neutral-300 hover:text-red-400 hover:bg-red-50 rounded-lg transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Add item */}
      <button
        onClick={addItem}
        className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-neutral-200 rounded-2xl text-sm text-neutral-400 hover:border-neutral-300 hover:text-neutral-600 transition-colors mb-10"
      >
        <Plus className="w-4 h-4" />
        Add item
      </button>

      {/* Save */}
      <button
        onClick={handleSave}
        disabled={!title.trim() || saving}
        className="w-full py-3.5 bg-rs-red text-white font-semibold rounded-2xl hover:bg-rs-red-deep transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        <Save className="w-4 h-4" />
        {saving ? "Saving…" : "Save Agenda"}
      </button>
      {showImport && (
        <AgendaImport team={people} currentTitle={title} hasItems={realItems.length > 0}
          onImport={applyImport} onClose={() => setShowImport(false)} />
      )}
    </div>
  );
}