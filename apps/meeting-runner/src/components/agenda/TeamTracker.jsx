import { useState, useRef } from "react";
import { api as base44 } from "@/api/m365";
import { Plus, Trash2, Pencil, X, Users, Mail } from "lucide-react";

const genId = () => Math.random().toString(36).slice(2, 9);

const emptyMember = () => ({ first_name: "", last_name: "", email: "", title: "" });

function MemberCard({ member, onDelete, onUpdate }) {
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    first_name: member.first_name,
    last_name: member.last_name,
    email: member.email || "",
    title: member.title || "",
  });

  const saveEdit = () => {
    if (!editForm.first_name.trim() && !editForm.last_name.trim()) return;
    onUpdate({ ...member, ...editForm, first_name: editForm.first_name.trim(), last_name: editForm.last_name.trim(), email: editForm.email.trim(), title: editForm.title.trim() });
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="bg-neutral-50 rounded-2xl border border-neutral-200 p-4 space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <input autoFocus value={editForm.first_name} placeholder="First name *"
            onChange={(e) => setEditForm((f) => ({ ...f, first_name: e.target.value }))}
            className="text-sm text-neutral-800 bg-white rounded-lg border border-neutral-200 px-2 py-1.5 outline-none"
          />
          <input value={editForm.last_name} placeholder="Last name *"
            onChange={(e) => setEditForm((f) => ({ ...f, last_name: e.target.value }))}
            className="text-sm text-neutral-800 bg-white rounded-lg border border-neutral-200 px-2 py-1.5 outline-none"
          />
        </div>
        <input value={editForm.email} placeholder="Email address"
          onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
          className="w-full text-xs text-neutral-600 bg-white rounded-lg border border-neutral-200 px-2 py-1.5 outline-none"
        />
        <input value={editForm.title} placeholder="Title / role"
          onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))}
          className="w-full text-xs text-neutral-600 bg-white rounded-lg border border-neutral-200 px-2 py-1.5 outline-none"
        />
        <div className="flex gap-2 pt-1">
          <button onClick={saveEdit}
            className="px-3 py-1 bg-rs-red text-white text-xs font-semibold rounded-lg hover:bg-rs-red-deep transition-colors">Save</button>
          <button onClick={() => setEditing(false)}
            className="px-3 py-1 text-xs text-neutral-400 hover:text-neutral-700">Cancel</button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-neutral-50 rounded-2xl border border-neutral-100 p-4 flex items-start gap-3">
      <div className="w-10 h-10 rounded-full bg-neutral-200 flex items-center justify-center text-sm font-bold text-neutral-600 flex-shrink-0">
        {(member.first_name?.[0] || "").toUpperCase()}{(member.last_name?.[0] || "").toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-neutral-800 leading-snug">
          {member.first_name} {member.last_name}
        </p>
        {member.title && <p className="text-xs text-neutral-500">{member.title}</p>}
        {member.email && (
          <a href={`mailto:${member.email}`} className="text-xs text-neutral-400 hover:text-neutral-600 flex items-center gap-1 mt-0.5">
            <Mail className="w-3 h-3" /> {member.email}
          </a>
        )}
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        <button onClick={() => setEditing(true)} title="Edit"
          className="p-1.5 text-neutral-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors">
          <Pencil className="w-3.5 h-3.5" />
        </button>
        <button onClick={() => onDelete(member.id)} title="Delete"
          className="p-1.5 text-neutral-400 hover:text-red-400 hover:bg-red-50 rounded-lg transition-colors">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

export default function TeamTracker({ agenda, onClose, save }) {
  // Latest saved copy of the agenda, so each save builds on the previous one
  const latest = useRef(agenda);
  const [members, setMembers] = useState(latest.current.team || []);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyMember());

  const persist = async (updated) => {
    setSaving(true);
    // A custom save (Teams manager) or the agenda's own save (which goes to its team if it has one).
    latest.current = save ? { ...latest.current, team: updated, ...(await save(updated)) } : await base44.entities.Agenda.update(agenda.id, { team: updated });
    setSaving(false);
  };

  const handleAdd = async () => {
    if (!form.first_name.trim() && !form.last_name.trim()) return;
    const newMember = { id: genId(), ...form, first_name: form.first_name.trim(), last_name: form.last_name.trim(), email: form.email.trim(), title: form.title.trim() };
    const updated = [...members, newMember];
    setMembers(updated);
    setForm(emptyMember());
    setShowForm(false);
    await persist(updated);
  };

  const handleUpdate = async (updatedMember) => {
    const updated = members.map((m) => (m.id === updatedMember.id ? updatedMember : m));
    setMembers(updated);
    await persist(updated);
  };

  const handleDelete = async (id) => {
    const updated = members.filter((m) => m.id !== id);
    setMembers(updated);
    await persist(updated);
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-3xl w-full max-w-lg max-h-[85vh] flex flex-col shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-5 border-b border-neutral-100">
          <div>
            <h2 className="text-lg font-bold text-neutral-900 flex items-center gap-2">
              <Users className="w-4 h-4 text-neutral-400" /> Team
            </h2>
            <p className="text-xs text-neutral-400 truncate max-w-xs">
              {agenda.title}{agenda.team_name && !save ? ` · members of the ${agenda.team_name} team (shared with its other agendas)` : ""}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {saving && <span className="text-xs text-neutral-400">Saving…</span>}
            <button onClick={onClose} className="p-2 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 rounded-xl transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2">
          {members.length === 0 && !showForm && (
            <p className="text-sm text-neutral-400 text-center py-8">No team members yet. Add one below.</p>
          )}

          {members.map((member) => (
            <MemberCard key={member.id} member={member} onDelete={handleDelete} onUpdate={handleUpdate} />
          ))}

          {showForm && (
            <div className="bg-neutral-50 rounded-2xl border border-neutral-200 p-4 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <input autoFocus value={form.first_name} placeholder="First name *"
                  onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))}
                  className="text-sm text-neutral-800 placeholder:text-neutral-300 bg-white rounded-lg border border-neutral-200 px-2 py-1.5 outline-none"
                />
                <input value={form.last_name} placeholder="Last name *"
                  onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))}
                  className="text-sm text-neutral-800 placeholder:text-neutral-300 bg-white rounded-lg border border-neutral-200 px-2 py-1.5 outline-none"
                />
              </div>
              <input type="email" value={form.email} placeholder="Email address"
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                className="w-full text-xs text-neutral-600 placeholder:text-neutral-300 bg-white rounded-lg border border-neutral-200 px-2 py-1.5 outline-none"
              />
              <input value={form.title} placeholder="Title / role"
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                className="w-full text-xs text-neutral-600 placeholder:text-neutral-300 bg-white rounded-lg border border-neutral-200 px-2 py-1.5 outline-none"
              />
              <div className="flex gap-2 pt-1">
                <button onClick={handleAdd} disabled={!form.first_name.trim() && !form.last_name.trim()}
                  className="px-4 py-1.5 bg-rs-red text-white text-xs font-semibold rounded-lg disabled:opacity-40 hover:bg-rs-red-deep transition-colors">Add Member</button>
                <button onClick={() => { setShowForm(false); setForm(emptyMember()); }}
                  className="px-4 py-1.5 text-xs text-neutral-500 hover:text-neutral-800 transition-colors">Cancel</button>
              </div>
            </div>
          )}
        </div>

        {!showForm && (
          <div className="px-6 pb-5">
            <button onClick={() => setShowForm(true)}
              className="w-full flex items-center justify-center gap-2 py-2.5 border-2 border-dashed border-neutral-200 rounded-2xl text-sm text-neutral-400 hover:border-neutral-300 hover:text-neutral-600 transition-colors">
              <Plus className="w-4 h-4" /> Add Team Member
            </button>
          </div>
        )}
      </div>
    </div>
  );
}