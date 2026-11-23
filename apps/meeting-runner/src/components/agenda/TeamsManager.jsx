// Create, rename and delete teams, and manage each team's members. Agendas are put on a
// team from the agenda editor; a team's agendas all share its member list.
import { useEffect, useState } from "react";
import { api } from "@/api/m365";
import { Users, X, Plus, Pencil, Trash2, Check } from "lucide-react";
import TeamTracker from "./TeamTracker";
import { memberName } from "@/lib/team";

const genId = () => Math.random().toString(36).slice(2, 9);

export default function TeamsManager({ agendas = [], onClose }) {
  const [teams, setTeams] = useState(null);
  const [error, setError] = useState("");
  const [newName, setNewName] = useState("");
  const [seedFrom, setSeedFrom] = useState("");
  const [renaming, setRenaming] = useState(null); // { id, name }
  const [membersOf, setMembersOf] = useState(null); // team
  const [confirmDelete, setConfirmDelete] = useState(null);

  const load = async () => {
    try {
      setTeams(await api.entities.Team.list("name"));
    } catch (e) {
      setError(e.message || "Couldn't load teams.");
      setTeams([]);
    }
  };
  useEffect(() => { load(); }, []);

  // Agendas with their own member list (made before teams existed) can seed a new team.
  const seedable = agendas.filter((a) => !a.team_id && (a.team || []).length);

  const create = async () => {
    if (!newName.trim()) return;
    const seed = agendas.find((a) => a.id === seedFrom);
    const members = seed ? (seed.team || []).map((m) => ({ ...m, id: m.id || genId() })) : [];
    try {
      const team = await api.entities.Team.create({ name: newName.trim(), members });
      if (seed) await api.entities.Agenda.update(seed.id, { team_id: team.id });
      setNewName("");
      setSeedFrom("");
      await load();
    } catch (e) {
      setError(e.message || "Couldn't create the team.");
    }
  };

  const rename = async () => {
    if (!renaming?.name.trim()) return;
    await api.entities.Team.update(renaming.id, { name: renaming.name.trim() });
    setRenaming(null);
    await load();
  };

  const remove = async (team) => {
    // Agendas keep a copy of the members so nothing is lost; they move to "No team".
    for (const a of agendas.filter((x) => x.team_id === team.id)) {
      await api.entities.Agenda.update(a.id, { team_id: null, team: team.members || [] });
    }
    await api.entities.Team.delete(team.id);
    setConfirmDelete(null);
    await load();
  };

  const countFor = (id) => agendas.filter((a) => a.team_id === id).length;

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-3xl w-full max-w-xl max-h-[85vh] flex flex-col shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-5 border-b border-neutral-100">
          <div>
            <h2 className="text-lg font-bold text-neutral-900 flex items-center gap-2"><Users className="w-4 h-4 text-neutral-400" /> Teams</h2>
            <p className="text-xs text-neutral-400">Each team has its members and its meeting agendas.</p>
          </div>
          <button onClick={onClose} className="p-2 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 rounded-xl"><X className="w-4 h-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2">
          {teams === null && <p className="text-sm text-neutral-400 py-6 text-center">Loading…</p>}
          {teams && !teams.length && <p className="text-sm text-neutral-400 py-6 text-center">No teams yet. Create your first one below.</p>}
          {(teams || []).map((t) => (
            <div key={t.id} className="rounded-2xl border border-neutral-200 p-4">
              <div className="flex items-center gap-2">
                {renaming?.id === t.id ? (
                  <>
                    <input autoFocus value={renaming.name} onChange={(e) => setRenaming({ ...renaming, name: e.target.value })}
                      onKeyDown={(e) => { if (e.key === "Enter") rename(); if (e.key === "Escape") setRenaming(null); }}
                      className="flex-1 text-sm font-semibold text-neutral-800 border border-neutral-200 rounded-lg px-2 py-1 outline-none" />
                    <button onClick={rename} className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg" title="Save"><Check className="w-4 h-4" /></button>
                  </>
                ) : (
                  <>
                    <p className="flex-1 text-sm font-semibold text-neutral-900">{t.name}</p>
                    <button onClick={() => setRenaming({ id: t.id, name: t.name })} className="p-1.5 text-neutral-300 hover:text-blue-500 hover:bg-blue-50 rounded-lg" title="Rename"><Pencil className="w-3.5 h-3.5" /></button>
                    <button onClick={() => setConfirmDelete(t)} className="p-1.5 text-neutral-300 hover:text-red-500 hover:bg-red-50 rounded-lg" title="Delete team"><Trash2 className="w-3.5 h-3.5" /></button>
                  </>
                )}
              </div>
              <p className="text-xs text-neutral-400 mt-1">
                {(t.members || []).length} member{(t.members || []).length === 1 ? "" : "s"} · {countFor(t.id)} agenda{countFor(t.id) === 1 ? "" : "s"}
              </p>
              {(t.members || []).length > 0 && (
                <p className="text-xs text-neutral-500 mt-1 truncate">{t.members.map(memberName).join(", ")}</p>
              )}
              <button onClick={() => setMembersOf(t)} className="mt-2 flex items-center gap-1.5 text-xs font-medium text-neutral-600 hover:text-neutral-900">
                <Users className="w-3.5 h-3.5" /> Manage members
              </button>
              {confirmDelete?.id === t.id && (
                <div className="mt-3 p-3 rounded-xl bg-red-50 border border-red-100 text-xs text-red-700">
                  Delete the {t.name} team? Its agendas aren't deleted. They move to "No team" and keep a copy of the members.
                  <div className="flex gap-2 mt-2">
                    <button onClick={() => remove(t)} className="px-3 py-1 bg-red-600 text-white rounded-lg font-semibold">Delete team</button>
                    <button onClick={() => setConfirmDelete(null)} className="px-3 py-1 text-red-700">Cancel</button>
                  </div>
                </div>
              )}
            </div>
          ))}
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>

        <div className="px-6 py-4 border-t border-neutral-100 space-y-2">
          <div className="flex gap-2">
            <input value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") create(); }}
              placeholder="New team name, e.g. Leadership" className="flex-1 text-sm border border-neutral-200 rounded-xl px-3 py-2 outline-none focus:border-neutral-400" />
            <button onClick={create} disabled={!newName.trim()} className="flex items-center gap-1 px-4 py-2 bg-neutral-900 text-white text-sm font-semibold rounded-xl disabled:opacity-40">
              <Plus className="w-4 h-4" /> Create
            </button>
          </div>
          {seedable.length > 0 && (
            <select value={seedFrom} onChange={(e) => setSeedFrom(e.target.value)} className="w-full text-xs text-neutral-600 border border-neutral-200 rounded-xl px-2 py-1.5 outline-none">
              <option value="">Start with no members</option>
              {seedable.map((a) => <option key={a.id} value={a.id}>Copy members from "{a.title}" ({a.team.length}) and put that agenda on this team</option>)}
            </select>
          )}
        </div>
      </div>

      {membersOf && (
        <div onClick={(e) => e.stopPropagation()}>
        <TeamTracker
          agenda={{ id: membersOf.id, title: membersOf.name, team: membersOf.members || [] }}
          save={(members) => api.entities.Team.update(membersOf.id, { members })}
          onClose={() => { setMembersOf(null); load(); }}
        />
        </div>
      )}
    </div>
  );
}
