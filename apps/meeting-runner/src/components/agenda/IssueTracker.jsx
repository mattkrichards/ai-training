import { useState, useRef } from "react";
import { api as base44 } from "@/api/m365";
import { Plus, Trash2, CheckCircle2, Circle, GripVertical, X, ChevronDown, ChevronUp } from "lucide-react";
import TeamSelect from "./TeamSelect";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";

const genId = () => Math.random().toString(36).slice(2, 9);

export default function IssueTracker({ agenda, onClose }) {
  // Latest saved copy of the agenda, so each save builds on the previous one
  const latest = useRef(agenda);
  const [issues, setIssues] = useState(
    (latest.current.issues || []).filter((i) => !i.deleted && !i.done)
  );
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", owner: "" });

  const persist = async (updated) => {
    setSaving(true);
    // Merge with existing done/deleted issues so we don't lose them
    const existing = latest.current.issues || [];
    const hiddenIssues = existing.filter((i) => i.deleted || i.done);
    latest.current = await base44.entities.Agenda.update(agenda.id, {
      issues: [...hiddenIssues, ...updated],
    });
    setSaving(false);
  };

  const handleAdd = async () => {
    if (!form.title.trim()) return;
    const newIssue = {
      id: genId(),
      title: form.title.trim(),
      description: form.description.trim(),
      owner: form.owner.trim(),
      created_date: new Date().toISOString().split("T")[0],
      done: false,
      deleted: false,
    };
    const updated = [...issues, newIssue];
    setIssues(updated);
    setForm({ title: "", description: "", owner: "" });
    setShowForm(false);
    await persist(updated);
  };

  const handleToggleDone = async (id) => {
    // Mark as done (removes from active list)
    const target = issues.find((i) => i.id === id);
    const donedIssue = { ...target, done: true };
    const updated = issues.filter((i) => i.id !== id);
    setIssues(updated);
    setSaving(true);
    const existing = latest.current.issues || [];
    const others = existing.filter((i) => i.id !== id && (i.deleted || i.done));
    latest.current = await base44.entities.Agenda.update(agenda.id, {
      issues: [...others, donedIssue, ...updated],
    });
    setSaving(false);
  };

  const handleDelete = async (id) => {
    const target = issues.find((i) => i.id === id);
    const deletedIssue = { ...target, deleted: true };
    const updated = issues.filter((i) => i.id !== id);
    setIssues(updated);
    setSaving(true);
    const existing = latest.current.issues || [];
    const others = existing.filter((i) => i.id !== id && (i.deleted || i.done));
    latest.current = await base44.entities.Agenda.update(agenda.id, {
      issues: [...others, deletedIssue, ...updated],
    });
    setSaving(false);
  };

  const handleDragEnd = async (result) => {
    if (!result.destination) return;
    const reordered = [...issues];
    const [moved] = reordered.splice(result.source.index, 1);
    reordered.splice(result.destination.index, 0, moved);
    setIssues(reordered);
    await persist(reordered);
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
            <h2 className="text-lg font-bold text-neutral-900">Issues</h2>
            <p className="text-xs text-neutral-400 truncate max-w-xs">{agenda.title}</p>
          </div>
          <div className="flex items-center gap-2">
            {saving && <span className="text-xs text-neutral-400">Saving…</span>}
            <button onClick={onClose} className="p-2 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 rounded-xl transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Issue list */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {issues.length === 0 && !showForm && (
            <p className="text-sm text-neutral-400 text-center py-8">No open issues. Add one below.</p>
          )}

          <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="issues">
              {(provided) => (
                <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-2">
                  {issues.map((issue, idx) => (
                    <Draggable key={issue.id} draggableId={issue.id} index={idx}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          className={`bg-neutral-50 rounded-2xl p-3 border transition-all ${
                            snapshot.isDragging ? "border-blue-300 shadow-lg" : "border-neutral-100"
                          }`}
                        >
                          <div className="flex items-start gap-2">
                            <div {...provided.dragHandleProps} className="mt-1 text-neutral-300 hover:text-neutral-500 cursor-grab">
                              <GripVertical className="w-4 h-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-neutral-800 leading-snug">{issue.title}</p>
                              {issue.description && (
                                <p className="text-xs text-neutral-500 mt-0.5 leading-snug">{issue.description}</p>
                              )}
                              <div className="flex items-center gap-3 mt-1">
                                {issue.owner && <span className="text-xs text-neutral-400">{issue.owner}</span>}
                                {issue.created_date && <span className="text-xs text-neutral-300">{issue.created_date}</span>}
                              </div>
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <button
                                onClick={() => handleToggleDone(issue.id)}
                                title="Mark done"
                                className="p-1.5 text-neutral-300 hover:text-emerald-500 hover:bg-emerald-50 rounded-lg transition-colors"
                              >
                                <CheckCircle2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDelete(issue.id)}
                                title="Delete"
                                className="p-1.5 text-neutral-300 hover:text-red-400 hover:bg-red-50 rounded-lg transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>

          {/* Add form */}
          {showForm && (
            <div className="mt-3 bg-neutral-50 rounded-2xl border border-neutral-200 p-4 space-y-2">
              <input
                autoFocus
                type="text"
                placeholder="Issue title *"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                className="w-full text-sm font-semibold text-neutral-800 placeholder:text-neutral-300 bg-transparent outline-none border-b border-neutral-200 pb-1"
              />
              <textarea
                placeholder="Description (optional)"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                rows={2}
                className="w-full text-xs text-neutral-600 placeholder:text-neutral-300 bg-transparent outline-none resize-none"
              />
              <TeamSelect team={agenda.team || []} value={form.owner}
                onChange={(v) => setForm((f) => ({ ...f, owner: v }))} />
              <div className="flex gap-2 pt-1">
                <button
                  onClick={handleAdd}
                  disabled={!form.title.trim()}
                  className="px-4 py-1.5 bg-neutral-900 text-white text-xs font-semibold rounded-lg hover:bg-neutral-700 disabled:opacity-40 transition-colors"
                >
                  Add Issue
                </button>
                <button
                  onClick={() => { setShowForm(false); setForm({ title: "", description: "", owner: "" }); }}
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
          <div className="px-6 pb-5">
            <button
              onClick={() => setShowForm(true)}
              className="w-full flex items-center justify-center gap-2 py-2.5 border-2 border-dashed border-neutral-200 rounded-2xl text-sm text-neutral-400 hover:border-neutral-300 hover:text-neutral-600 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Issue
            </button>
          </div>
        )}
      </div>
    </div>
  );
}