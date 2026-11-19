import { useState, useEffect, useRef } from "react";
import { createPageUrl } from "@/utils";
import { api as base44 } from "@/api/m365";
import {
  ChevronLeft, ChevronRight, Play, Pause, RotateCcw, X,
  CheckCircle, Copy, Mail, FileText, AlertCircle, GripVertical,
  Trash2, CheckCircle2, Pencil, Plus, Target, ChevronDown
} from "lucide-react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";

function formatTime(seconds) {
  const m = Math.floor(Math.abs(seconds) / 60);
  const s = Math.abs(seconds) % 60;
  const sign = seconds < 0 ? "-" : "";
  return `${sign}${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function formatMins(seconds) {
  const totalSecs = Math.abs(seconds);
  const m = Math.floor(totalSecs / 60);
  const s = totalSecs % 60;
  if (m === 0) return `${s}s`;
  if (s === 0) return `${m}m`;
  return `${m}m ${s}s`;
}

const genId = () => Math.random().toString(36).slice(2, 9);

// Sidebar tab selector
function SidebarTabs({ active, onChange, issueCount }) {
  return (
    <div className="flex border-b border-white/5 mb-4">
      <button
        onClick={() => onChange("agenda")}
        className={`flex-1 py-2 text-xs font-semibold tracking-[0.1em] uppercase transition-colors ${
          active === "agenda" ? "text-white border-b-2 border-white/40" : "text-white/30 hover:text-white/60"
        }`}
      >
        Items
      </button>
      <button
        onClick={() => onChange("issues")}
        className={`flex-1 py-2 text-xs font-semibold tracking-[0.1em] uppercase transition-colors flex items-center justify-center gap-1 ${
          active === "issues" ? "text-white border-b-2 border-white/40" : "text-white/30 hover:text-white/60"
        }`}
      >
        Issues
        {issueCount > 0 && (
          <span className="bg-orange-500/70 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center leading-none">
            {issueCount}
          </span>
        )}
      </button>
    </div>
  );
}

export default function MeetingTimer({ agenda }) {
  const items = agenda.items || [];
  const [currentIdx, setCurrentIdx] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState((items[0]?.duration || 0) * 60);
  const [running, setRunning] = useState(false);
  const [completed, setCompleted] = useState([]);
  const [meetingNotes, setMeetingNotes] = useState({});
  const [timeSpent, setTimeSpent] = useState({});
  const [showSummary, setShowSummary] = useState(false);
  const [emailAddress, setEmailAddress] = useState("");
  const [emailSent, setEmailSent] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [copied, setCopied] = useState(false);
  const [totalElapsed, setTotalElapsed] = useState(0);
  const [sidebarTab, setSidebarTab] = useState("agenda");

  // Issues state
  const [issues, setIssues] = useState(
    (agenda.issues || []).filter((i) => !i.deleted && !i.done)
  );
  const hiddenIssuesRef = useRef(
    (agenda.issues || []).filter((i) => i.deleted || i.done)
  );
  const [issueActivity, setIssueActivity] = useState([]);
  const [editingIssueId, setEditingIssueId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState({ title: "", description: "", owner: "" });

  // Todos state
  const [todos, setTodos] = useState(
    (agenda.todos || []).filter((t) => !t.deleted && !t.done)
  );
  const hiddenTodosRef = useRef(
    (agenda.todos || []).filter((t) => t.deleted || t.done)
  );
  const [editingTodoId, setEditingTodoId] = useState(null);
  const [editTodoForm, setEditTodoForm] = useState({});
  const [showAddTodoForm, setShowAddTodoForm] = useState(false);
  const [addTodoForm, setAddTodoForm] = useState({ title: "", description: "", assignees: "" });

  // Rocks state
  const [rocks, setRocks] = useState(
    (agenda.rocks || []).filter((r) => !r.deleted && !r.done)
  );
  const hiddenRocksRef = useRef(
    (agenda.rocks || []).filter((r) => r.deleted || r.done)
  );
  const [showAddRockForm, setShowAddRockForm] = useState(false);
  const [addRockForm, setAddRockForm] = useState({ title: "", owner: "", start_date: "", due_date: "", on_track: true });
  const [editingRockId, setEditingRockId] = useState(null);
  const [editRockForm, setEditRockForm] = useState({ title: "", owner: "", start_date: "", due_date: "" });

  // Scorecard state
  const [scorecard, setScorecard] = useState(agenda.scorecard || []);
  const [expandedMetricId, setExpandedMetricId] = useState(null);
  const [logForm, setLogForm] = useState({ date: new Date().toISOString().split("T")[0], value: "" });
  const [showLogFor, setShowLogFor] = useState(null);
  const [showAddMetricForm, setShowAddMetricForm] = useState(false);
  const [addMetricForm, setAddMetricForm] = useState({ name: "", description: "", owner: "", target: "", unit: "", higher_is_better: true });

  // Right sidebar tab: "issues" | "todos" | "rocks"
  const [rightTab, setRightTab] = useState("issues");

  // Left sidebar collapsed state
  const [leftCollapsed, setLeftCollapsed] = useState(false);

  const intervalRef = useRef(null);
  // Timestamp-based refs (tab-switch safe)
  const runStartRef = useRef(null);       // when current run segment started (Date.now())
  const itemBaseSecondsRef = useRef((items[0]?.duration || 0) * 60); // secondsLeft at run start
  const totalBaseRef = useRef(0);         // totalElapsed at run start
  const itemStartRef = useRef(null);      // for timeSpent tracking (Date.now())
  const accruedTimeSpentRef = useRef({}); // accumulated timeSpent before current run segment

  const currentItem = items[currentIdx];
  const isOvertime = secondsLeft < 0;
  const progress = currentItem ? Math.max(0, secondsLeft / (currentItem.duration * 60)) : 0;
  const totalMins = items.reduce((s, i) => s + (i.duration || 0), 0);
  const completedMins = completed.reduce((s, idx) => s + (items[idx]?.duration || 0), 0);

  useEffect(() => {
    if (running) {
      runStartRef.current = Date.now();
      itemBaseSecondsRef.current = secondsLeft;
      totalBaseRef.current = totalElapsed;
      itemStartRef.current = Date.now();

      intervalRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - runStartRef.current) / 1000);
        setSecondsLeft(itemBaseSecondsRef.current - elapsed);
        setTotalElapsed(totalBaseRef.current + elapsed);
      }, 250); // poll 4x/sec for smooth display
    } else {
      clearInterval(intervalRef.current);
      if (itemStartRef.current) {
        const elapsed = Math.floor((Date.now() - itemStartRef.current) / 1000);
        setTimeSpent((prev) => {
          const updated = { ...prev, [currentIdx]: (prev[currentIdx] || 0) + elapsed };
          accruedTimeSpentRef.current = updated;
          return updated;
        });
        itemStartRef.current = null;
      }
    }
    return () => clearInterval(intervalRef.current);
  }, [running]);

  const goTo = (idx) => {
    if (idx < 0 || idx >= items.length) return;
    if (running && itemStartRef.current) {
      const elapsed = Math.floor((Date.now() - itemStartRef.current) / 1000);
      setTimeSpent((prev) => {
        const updated = { ...prev, [currentIdx]: (prev[currentIdx] || 0) + elapsed };
        accruedTimeSpentRef.current = updated;
        return updated;
      });
      itemStartRef.current = null;
    }
    const newSeconds = (items[idx]?.duration || 0) * 60;
    setCurrentIdx(idx);
    setSecondsLeft(newSeconds);
    if (running) {
      runStartRef.current = Date.now();
      itemBaseSecondsRef.current = newSeconds;
      totalBaseRef.current = totalElapsed;
      itemStartRef.current = Date.now();
    }
  };

  const markComplete = () => {
    setCompleted((prev) => [...new Set([...prev, currentIdx])]);
    if (currentIdx < items.length - 1) {
      goTo(currentIdx + 1);
    } else {
      setRunning(false);
      setShowSummary(true);
    }
  };

  const reset = () => {
    setRunning(false);
    setSecondsLeft((currentItem?.duration || 0) * 60);
  };

  // ── Issue actions ──────────────────────────────────────────────

  const persistIssues = async (updatedActive) => {
    await base44.entities.Agenda.update(agenda.id, {
      issues: [...hiddenIssuesRef.current, ...updatedActive],
    });
  };

  const logActivity = (msg) => {
    const time = new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
    setIssueActivity((prev) => [...prev, `[${time}] ${msg}`]);
  };

  const handleAddIssue = async () => {
    if (!addForm.title.trim()) return;
    const newIssue = {
      id: genId(),
      title: addForm.title.trim(),
      description: addForm.description.trim(),
      owner: addForm.owner.trim(),
      created_date: new Date().toISOString().split("T")[0],
      done: false,
      deleted: false,
    };
    const updated = [...issues, newIssue];
    setIssues(updated);
    logActivity(`Added issue: "${newIssue.title}"${newIssue.owner ? ` (${newIssue.owner})` : ""}`);
    setAddForm({ title: "", description: "", owner: "" });
    setShowAddForm(false);
    await persistIssues(updated);
  };

  const handleMarkDone = async (id) => {
    const target = issues.find((i) => i.id === id);
    const updated = issues.filter((i) => i.id !== id);
    const doneRecord = { ...target, done: true };
    hiddenIssuesRef.current = [...hiddenIssuesRef.current, doneRecord];
    setIssues(updated);
    logActivity(`Marked done: "${target.title}"`);
    await base44.entities.Agenda.update(agenda.id, {
      issues: [...hiddenIssuesRef.current, ...updated],
    });
  };

  const handleDeleteIssue = async (id) => {
    const target = issues.find((i) => i.id === id);
    const updated = issues.filter((i) => i.id !== id);
    const deletedRecord = { ...target, deleted: true };
    hiddenIssuesRef.current = [...hiddenIssuesRef.current, deletedRecord];
    setIssues(updated);
    logActivity(`Deleted issue: "${target.title}"`);
    await base44.entities.Agenda.update(agenda.id, {
      issues: [...hiddenIssuesRef.current, ...updated],
    });
  };

  const handleStartEdit = (issue) => {
    setEditingIssueId(issue.id);
    setEditForm({ title: issue.title, description: issue.description || "", owner: issue.owner || "" });
  };

  const handleSaveEdit = async () => {
    const updated = issues.map((i) =>
      i.id === editingIssueId
        ? { ...i, title: editForm.title, description: editForm.description, owner: editForm.owner }
        : i
    );
    const original = issues.find((i) => i.id === editingIssueId);
    logActivity(`Edited issue: "${original.title}"${editForm.title !== original.title ? ` → "${editForm.title}"` : ""}`);
    setIssues(updated);
    setEditingIssueId(null);
    await persistIssues(updated);
  };

  const handleIssueReorder = async (result) => {
    if (!result.destination) return;
    const reordered = [...issues];
    const [moved] = reordered.splice(result.source.index, 1);
    reordered.splice(result.destination.index, 0, moved);
    setIssues(reordered);
    logActivity(`Reordered issues`);
    await persistIssues(reordered);
  };

  // ── Todo actions ───────────────────────────────────────────────

  const persistTodos = async (updatedActive) => {
    await base44.entities.Agenda.update(agenda.id, {
      todos: [...hiddenTodosRef.current, ...updatedActive],
    });
  };

  const handleAddTodo = async () => {
    if (!addTodoForm.title.trim()) return;
    const newTodo = {
      id: genId(),
      title: addTodoForm.title.trim(),
      description: addTodoForm.description.trim(),
      assignees: addTodoForm.assignees.trim(),
      created_date: new Date().toISOString().split("T")[0],
      done: false,
      deleted: false,
    };
    const updated = [...todos, newTodo];
    setTodos(updated);
    setAddTodoForm({ title: "", description: "", assignees: "" });
    setShowAddTodoForm(false);
    await persistTodos(updated);
  };

  const handleMarkTodoDone = async (id) => {
    const target = todos.find((t) => t.id === id);
    const doneRecord = { ...target, done: true };
    hiddenTodosRef.current = [...hiddenTodosRef.current, doneRecord];
    const updated = todos.filter((t) => t.id !== id);
    setTodos(updated);
    await base44.entities.Agenda.update(agenda.id, {
      todos: [...hiddenTodosRef.current, ...updated],
    });
  };

  const handleDeleteTodo = async (id) => {
    const target = todos.find((t) => t.id === id);
    const deletedRecord = { ...target, deleted: true };
    hiddenTodosRef.current = [...hiddenTodosRef.current, deletedRecord];
    const updated = todos.filter((t) => t.id !== id);
    setTodos(updated);
    await base44.entities.Agenda.update(agenda.id, {
      todos: [...hiddenTodosRef.current, ...updated],
    });
  };

  const handleStartEditTodo = (todo) => {
    setEditingTodoId(todo.id);
    setEditTodoForm({ title: todo.title, description: todo.description || "", assignees: todo.assignees || "" });
  };

  const handleSaveEditTodo = async () => {
    const updated = todos.map((t) =>
      t.id === editingTodoId
        ? { ...t, title: editTodoForm.title, description: editTodoForm.description, assignees: editTodoForm.assignees }
        : t
    );
    setTodos(updated);
    setEditingTodoId(null);
    await persistTodos(updated);
  };

  // ── Rock actions ───────────────────────────────────────────────

  const persistRocks = async (updatedActive) => {
    await base44.entities.Agenda.update(agenda.id, {
      rocks: [...hiddenRocksRef.current, ...updatedActive],
    });
  };

  const handleAddRock = async () => {
    if (!addRockForm.title.trim()) return;
    const newRock = {
      id: genId(),
      title: addRockForm.title.trim(),
      owner: addRockForm.owner.trim(),
      start_date: addRockForm.start_date,
      due_date: addRockForm.due_date,
      on_track: addRockForm.on_track,
      deleted: false,
      milestones: [],
    };
    const updated = [...rocks, newRock];
    setRocks(updated);
    setAddRockForm({ title: "", owner: "", start_date: "", due_date: "", on_track: true });
    setShowAddRockForm(false);
    await persistRocks(updated);
  };

  const handleDeleteRock = async (id) => {
    const target = rocks.find((r) => r.id === id);
    hiddenRocksRef.current = [...hiddenRocksRef.current, { ...target, deleted: true }];
    const updated = rocks.filter((r) => r.id !== id);
    setRocks(updated);
    await base44.entities.Agenda.update(agenda.id, {
      rocks: [...hiddenRocksRef.current, ...updated],
    });
  };

  const handleToggleRockOnTrack = async (id) => {
    const updated = rocks.map((r) => r.id === id ? { ...r, on_track: !r.on_track } : r);
    setRocks(updated);
    await persistRocks(updated);
  };

  const handleStartEditRock = (rock) => {
    setEditingRockId(rock.id);
    setEditRockForm({ title: rock.title, owner: rock.owner || "", start_date: rock.start_date || "", due_date: rock.due_date || "" });
  };

  const handleSaveEditRock = async () => {
    if (!editRockForm.title.trim()) return;
    const updated = rocks.map((r) =>
      r.id === editingRockId ? { ...r, title: editRockForm.title.trim(), owner: editRockForm.owner.trim(), start_date: editRockForm.start_date, due_date: editRockForm.due_date } : r
    );
    setRocks(updated);
    setEditingRockId(null);
    await persistRocks(updated);
  };

  const handleCompleteRock = async (id) => {
    const target = rocks.find((r) => r.id === id);
    const doneRecord = { ...target, done: true };
    hiddenRocksRef.current = [...hiddenRocksRef.current, doneRecord];
    const updated = rocks.filter((r) => r.id !== id);
    setRocks(updated);
    await base44.entities.Agenda.update(agenda.id, {
      rocks: [...hiddenRocksRef.current, ...updated],
    });
  };

  // ── Scorecard actions ──────────────────────────────────────────
  const persistScorecard = async (updated) => {
    await base44.entities.Agenda.update(agenda.id, { scorecard: updated });
  };

  const handleLogScore = async (metricId) => {
    if (logForm.value === "" || isNaN(Number(logForm.value))) return;
    const updated = scorecard.map((m) =>
      m.id === metricId
        ? { ...m, history: [...(m.history || []), { id: genId(), date: logForm.date, value: Number(logForm.value) }] }
        : m
    );
    setScorecard(updated);
    setLogForm({ date: new Date().toISOString().split("T")[0], value: "" });
    setShowLogFor(null);
    await persistScorecard(updated);
  };

  const handleDeleteScore = async (metricId, entryId) => {
    const updated = scorecard.map((m) =>
      m.id === metricId ? { ...m, history: (m.history || []).filter((h) => h.id !== entryId) } : m
    );
    setScorecard(updated);
    await persistScorecard(updated);
  };

  const handleAddMetric = async () => {
    if (!addMetricForm.name.trim()) return;
    const newMetric = {
      id: genId(),
      name: addMetricForm.name.trim(),
      description: addMetricForm.description.trim(),
      owner: addMetricForm.owner,
      target: Number(addMetricForm.target) || 0,
      unit: addMetricForm.unit.trim(),
      higher_is_better: addMetricForm.higher_is_better,
      history: [],
    };
    const updated = [...scorecard, newMetric];
    setScorecard(updated);
    setAddMetricForm({ name: "", description: "", owner: "", target: "", unit: "", higher_is_better: true });
    setShowAddMetricForm(false);
    await persistScorecard(updated);
  };

  const handleTodoReorder = async (result) => {
    if (!result.destination) return;
    const reordered = [...todos];
    const [moved] = reordered.splice(result.source.index, 1);
    reordered.splice(result.destination.index, 0, moved);
    setTodos(reordered);
    await persistTodos(reordered);
  };

  // ── Summary ────────────────────────────────────────────────────

  const buildSummaryText = () => {
    const date = new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
    let text = `Meeting Summary: ${agenda.title}\n${date}\n\n`;

    text += `━━ AGENDA ITEMS ━━\n\n`;
    items.forEach((item, idx) => {
      const allocated = item.duration || 0;
      const spent = timeSpent[idx] || 0;
      const spentMins = Math.floor(spent / 60);
      const spentSecs = spent % 60;
      const spentLabel = spentSecs > 0 ? `${spentMins}m ${spentSecs}s` : `${spentMins}m`;
      text += `── ${item.title || "Untitled"}\n`;
      text += `   Allocated: ${allocated}m  |  Actual: ${spentLabel}\n`;
      if (item.presenter) text += `   Presenter: ${item.presenter}\n`;
      const notes = meetingNotes[idx];
      if (notes?.trim()) text += `   Notes: ${notes.trim()}\n`;
      text += "\n";
    });

    // Issues section
    const allIssues = agenda.issues || [];
    const activeIssues = issues; // current in-memory list
    const doneThisMeeting = issueActivity.filter((a) => a.includes("Marked done:"));
    const addedThisMeeting = issueActivity.filter((a) => a.includes("Added issue:"));

    text += `━━ ISSUES ━━\n\n`;

    if (activeIssues.length > 0) {
      text += `Open Issues (${activeIssues.length}):\n`;
      activeIssues.forEach((issue, i) => {
        text += `  ${i + 1}. ${issue.title}`;
        if (issue.owner) text += ` — ${issue.owner}`;
        text += "\n";
        if (issue.description) text += `     ${issue.description}\n`;
      });
      text += "\n";
    } else {
      text += `Open Issues: none\n\n`;
    }

    if (issueActivity.length > 0) {
      text += `Issue Activity This Meeting:\n`;
      issueActivity.forEach((a) => { text += `  ${a}\n`; });
      text += "\n";
    }

    text += `━━ TO DOS ━━\n\n`;
    if (todos.length > 0) {
      text += `Open To Dos (${todos.length}):\n`;
      todos.forEach((todo, i) => {
        text += `  ${i + 1}. ${todo.title}`;
        if (todo.assignees) text += ` — ${todo.assignees}`;
        text += "\n";
        if (todo.description) text += `     ${todo.description}\n`;
      });
      text += "\n";
    } else {
      text += `Open To Dos: none\n\n`;
    }

    text += `━━ ROCKS ━━\n\n`;
    if (rocks.length > 0) {
      rocks.forEach((rock, i) => {
        text += `  ${i + 1}. ${rock.title}`;
        if (rock.owner) text += ` — ${rock.owner}`;
        text += ` [${rock.on_track ? "On Track" : "Off Track"}]`;
        if (rock.due_date) text += ` (due ${rock.due_date})`;
        text += "\n";
        if ((rock.milestones || []).length > 0) {
          rock.milestones.forEach((m) => {
            text += `     - ${m.title}${m.due_date ? ` (${m.due_date})` : ""}${m.done ? " ✓" : ""}\n`;
          });
        }
      });
      text += "\n";
    } else {
      text += `Rocks: none\n\n`;
    }

    return text.trim();
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(buildSummaryText());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleEmail = async () => {
    if (!emailAddress.trim()) return;
    setSendingEmail(true);
    const body = buildSummaryText().replace(/\n/g, "<br>");
    await base44.integrations.Core.SendEmail({
      to: emailAddress.trim(),
      subject: `Meeting Summary: ${agenda.title}`,
      body,
    });
    setSendingEmail(false);
    setEmailSent(true);
    setTimeout(() => setEmailSent(false), 3000);
  };

  const allDone = completed.length === items.length;

  // ── Background ─────────────────────────────────────────────────
  const elapsed = 1 - progress;
  let bgColor = "#0A0A0A";
  if (isOvertime) bgColor = "#3b0000";
  else if (elapsed >= 0.8) bgColor = "#3b0000";
  else if (elapsed >= 0.6) bgColor = "#3b1500";
  else if (elapsed >= 0.4) bgColor = "#3b2800";
  else if (elapsed >= 0.2) bgColor = "#0a2b1a";

  const R = 120;
  const C = 2 * Math.PI * R;
  const dash = C * (1 - progress);

  // ── Summary screen ─────────────────────────────────────────────
  if (showSummary || allDone) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] text-white flex flex-col">
        <div className="flex items-center justify-between px-8 py-5 border-b border-white/5">
          <a href={createPageUrl("Home")} className="flex items-center gap-2 text-white/40 hover:text-white/80 text-sm transition-colors">
            <X className="w-4 h-4" /> Exit
          </a>
          <p className="text-xs font-semibold tracking-[0.2em] text-white/30 uppercase">{agenda.title}</p>
          <div />
        </div>

        <div className="flex-1 overflow-y-auto max-w-2xl mx-auto w-full px-6 py-10">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">Meeting Complete</h2>
              <p className="text-white/40 text-sm">{new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</p>
            </div>
          </div>

          {/* Agenda items */}
          <p className="text-xs font-semibold tracking-[0.15em] text-white/30 uppercase mb-3">Agenda Items</p>
          <div className="space-y-3 mb-8">
            {items.map((item, idx) => {
              const allocated = item.duration || 0;
              const spent = timeSpent[idx] || 0;
              const over = spent > allocated * 60;
              return (
                <div key={item.id || idx} className="bg-white/5 rounded-2xl p-4">
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <div>
                      <p className="font-semibold text-sm">{item.title || "Untitled"}</p>
                      {item.presenter && <p className="text-xs text-white/40">{item.presenter}</p>}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className={`text-sm font-semibold ${over ? "text-red-400" : "text-emerald-400"}`}>
                        {formatMins(spent)} actual
                      </p>
                      <p className="text-xs text-white/30">{allocated}m allocated</p>
                    </div>
                  </div>
                  <textarea
                    value={meetingNotes[idx] || ""}
                    onChange={(e) => setMeetingNotes((prev) => ({ ...prev, [idx]: e.target.value }))}
                    placeholder="Add notes for this section…"
                    rows={2}
                    className="w-full bg-white/5 rounded-xl px-3 py-2 text-sm text-white/70 placeholder:text-white/20 outline-none resize-none border border-white/5 focus:border-white/20 transition-colors"
                  />
                </div>
              );
            })}
          </div>

          {/* Issues summary */}
          <p className="text-xs font-semibold tracking-[0.15em] text-white/30 uppercase mb-3">Issues</p>
          <div className="bg-white/5 rounded-2xl p-4 mb-8 space-y-2">
            {issues.length === 0 ? (
              <p className="text-sm text-white/30">No open issues remaining.</p>
            ) : (
              <>
                <p className="text-xs text-white/40 mb-2">{issues.length} open issue{issues.length !== 1 ? "s" : ""} remaining</p>
                {issues.map((issue) => (
                  <div key={issue.id} className="flex items-start gap-2">
                    <AlertCircle className="w-3.5 h-3.5 text-orange-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm text-white/80">{issue.title}</p>
                      {issue.owner && <p className="text-xs text-white/30">{issue.owner}</p>}
                    </div>
                  </div>
                ))}
              </>
            )}
            {issueActivity.length > 0 && (
              <div className="mt-3 pt-3 border-t border-white/10">
                <p className="text-xs text-white/30 mb-1">Activity this meeting:</p>
                {issueActivity.map((a, i) => (
                  <p key={i} className="text-xs text-white/40">{a}</p>
                ))}
              </div>
            )}
          </div>

          {/* Todos summary */}
          <p className="text-xs font-semibold tracking-[0.15em] text-white/30 uppercase mb-3">To Dos</p>
          <div className="bg-white/5 rounded-2xl p-4 mb-8 space-y-2">
            {todos.length === 0 ? (
              <p className="text-sm text-white/30">No open to dos remaining.</p>
            ) : (
              <>
                <p className="text-xs text-white/40 mb-2">{todos.length} open to do{todos.length !== 1 ? "s" : ""} remaining</p>
                {todos.map((todo) => (
                  <div key={todo.id} className="flex items-start gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-blue-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm text-white/80">{todo.title}</p>
                      {todo.assignees && <p className="text-xs text-white/30">{todo.assignees}</p>}
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>

          {/* Rocks summary */}
          <p className="text-xs font-semibold tracking-[0.15em] text-white/30 uppercase mb-3">Rocks</p>
          <div className="bg-white/5 rounded-2xl p-4 mb-8 space-y-3">
            {rocks.length === 0 ? (
              <p className="text-sm text-white/30">No rocks.</p>
            ) : (
              rocks.map((rock) => (
                <div key={rock.id}>
                  <div className="flex items-start gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm text-white/80">{rock.title}</p>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${rock.on_track ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"}`}>
                          {rock.on_track ? "On Track" : "Off Track"}
                        </span>
                      </div>
                      {rock.owner && <p className="text-xs text-white/30">{rock.owner}</p>}
                      {rock.due_date && <p className="text-xs text-white/20">Due {rock.due_date}</p>}
                    </div>
                  </div>
                  {(rock.milestones || []).length > 0 && (
                    <div className="mt-1.5 ml-2 space-y-0.5">
                      {rock.milestones.map((m) => (
                        <p key={m.id} className={`text-xs ${m.done ? "text-white/20 line-through" : "text-white/40"}`}>
                          · {m.title}{m.due_date ? ` (${m.due_date})` : ""}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Export */}
          <div className="bg-white/5 rounded-2xl p-5 space-y-4">
            <p className="text-xs font-semibold tracking-[0.15em] text-white/30 uppercase">Export Summary</p>
            <button
              onClick={handleCopy}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-white/10 hover:bg-white/15 text-sm font-medium transition-colors"
            >
              <Copy className="w-4 h-4" />
              {copied ? "Copied!" : "Copy to Clipboard"}
            </button>
            <div className="flex gap-2">
              <input
                type="email"
                placeholder="Email address…"
                value={emailAddress}
                onChange={(e) => setEmailAddress(e.target.value)}
                className="flex-1 bg-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/30 outline-none border border-white/5 focus:border-white/20 transition-colors"
              />
              <button
                onClick={handleEmail}
                disabled={sendingEmail || !emailAddress.trim()}
                className="flex items-center gap-2 px-5 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl text-sm font-medium transition-colors"
              >
                <Mail className="w-4 h-4" />
                {emailSent ? "Sent!" : sendingEmail ? "Sending…" : "Send"}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Timer screen ───────────────────────────────────────────────
  return (
    <div className="min-h-screen text-white flex flex-col transition-colors duration-1000" style={{ backgroundColor: bgColor }}>
      {/* Top bar */}
      <div className="flex items-center justify-between px-8 py-5 border-b border-white/5">
        <a href={createPageUrl("Home")} className="flex items-center gap-2 text-white/40 hover:text-white/80 text-sm transition-colors">
          <X className="w-4 h-4" /> Exit
        </a>
        <p className="text-xs font-semibold tracking-[0.2em] text-white/30 uppercase">{agenda.title}</p>
        <div className="text-right">
          <p className="text-xs text-white/30">{completedMins} / {totalMins} min allocated</p>
          <p className="text-sm font-semibold tabular-nums text-white/60">{formatTime(totalElapsed)} elapsed</p>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden" style={{ height: 0 }}>
        {/* Left sidebar — agenda items (collapsible) */}
        <div className={`${leftCollapsed ? "w-10" : "flex-1"} border-r border-white/5 flex-shrink-0 flex flex-col`}>
          <button
            onClick={() => setLeftCollapsed((v) => !v)}
            className="p-2 m-1 rounded-lg text-white/40 hover:text-white/80 hover:bg-white/10 transition-colors self-start"
            title={leftCollapsed ? "Expand items" : "Collapse items"}
          >
            {leftCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
          {!leftCollapsed && (
            <div className="flex-1 overflow-y-auto px-3 pb-6">
              <p className="text-xs font-semibold tracking-[0.15em] text-white/30 uppercase mb-3 px-2">Items</p>
              <div className="space-y-1">
                {items.map((item, idx) => {
                  const isDone = completed.includes(idx);
                  const isActive = idx === currentIdx;
                  return (
                    <button
                      key={item.id}
                      onClick={() => goTo(idx)}
                      className={`w-full text-left px-3 py-2 rounded-xl text-sm transition-all ${
                        isActive ? "bg-white/10 text-white" : isDone ? "text-white/25" : "text-white/50 hover:text-white/80 hover:bg-white/5"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isActive ? "bg-white" : isDone ? "bg-emerald-500" : "bg-white/20"}`} />
                        <span className={`flex-1 truncate font-medium text-xs ${isDone ? "line-through" : ""}`}>{item.title || "Untitled"}</span>
                        <span className="text-xs text-white/30 flex-shrink-0">{item.duration}m</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Main timer */}
        <div className="w-1/4 flex-shrink-0 flex flex-col items-center justify-center gap-6 px-4 overflow-hidden">
          <div className="text-center">
            <span className="text-xs font-semibold tracking-[0.15em] text-white/30 uppercase">
              Item {currentIdx + 1} of {items.length}
            </span>
            <h2 className="text-2xl font-bold tracking-tight mt-1">{currentItem?.title || "Untitled"}</h2>
            {currentItem?.presenter && <p className="text-white/40 text-sm mt-1">{currentItem.presenter}</p>}
          </div>

          <div className="relative w-56 h-56">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 280 280">
              <circle cx="140" cy="140" r={R} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
              <circle
                cx="140" cy="140" r={R}
                fill="none"
                stroke={isOvertime ? "#f87171" : "#10b981"}
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={C}
                strokeDashoffset={isOvertime ? 0 : dash}
                className="transition-all duration-500"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={`text-5xl font-bold tabular-nums tracking-tight ${isOvertime ? "text-red-400" : "text-white"}`}>
                {formatTime(secondsLeft)}
              </span>
              {isOvertime && <span className="text-xs text-red-400/70 font-semibold tracking-widest uppercase mt-1">Overtime</span>}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={() => goTo(currentIdx - 1)} disabled={currentIdx === 0} className="p-2 rounded-xl border border-white/10 text-white/40 hover:text-white/80 hover:border-white/20 disabled:opacity-20 disabled:cursor-not-allowed transition-all">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button onClick={reset} className="p-2 rounded-xl border border-white/10 text-white/40 hover:text-white/80 hover:border-white/20 transition-all">
              <RotateCcw className="w-4 h-4" />
            </button>
            <button onClick={() => setRunning((r) => !r)} className="px-5 py-2.5 bg-white text-black font-bold rounded-2xl hover:bg-white/90 transition-all text-sm flex items-center gap-1.5">
              {running ? <Pause className="w-4 h-4 fill-black" /> : <Play className="w-4 h-4 fill-black" />}
              {running ? "Pause" : "Start"}
            </button>
            <button onClick={markComplete} className="p-2 rounded-xl border border-white/10 text-white/40 hover:text-emerald-400 hover:border-emerald-500/30 transition-all" title="Mark done & next">
              <CheckCircle className="w-4 h-4" />
            </button>
            <button onClick={() => goTo(currentIdx + 1)} disabled={currentIdx === items.length - 1} className="p-2 rounded-xl border border-white/10 text-white/40 hover:text-white/80 hover:border-white/20 disabled:opacity-20 disabled:cursor-not-allowed transition-all">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {currentItem?.notes && (
            <div className="max-w-md w-full bg-white/5 rounded-2xl p-4">
              <p className="text-xs font-semibold text-white/30 uppercase tracking-wider mb-1">Agenda Notes</p>
              <p className="text-sm text-white/60">{currentItem.notes}</p>
            </div>
          )}
        </div>

        {/* Right sidebar — Issues / Todos */}
        <div className="w-1/2 border-l border-white/10 bg-white/[0.03] py-4 px-4 overflow-y-auto flex-shrink-0 flex flex-col">
          {/* Notes (moved above the trackers) */}
          <div className="mb-4">
            <p className="text-xs font-semibold tracking-[0.15em] text-white/30 uppercase mb-2 flex items-center gap-1">
              <FileText className="w-3 h-3" /> Notes
            </p>
            <textarea
              value={meetingNotes[currentIdx] || ""}
              onChange={(e) => setMeetingNotes((prev) => ({ ...prev, [currentIdx]: e.target.value }))}
              placeholder="Type notes here…"
              rows={4}
              className="w-full bg-white/5 rounded-xl px-3 py-2 text-xs text-white/70 placeholder:text-white/20 outline-none resize-none border border-white/5 focus:border-white/20 transition-colors"
            />
          </div>
          {/* Tab switcher */}
          <div className="flex border-b border-white/10 mb-4">
            <button
              onClick={() => setRightTab("issues")}
              className={`flex-1 py-2.5 text-xs font-bold tracking-[0.1em] uppercase transition-colors flex items-center justify-center gap-1 ${
                rightTab === "issues" ? "text-white border-b-2 border-white" : "text-white/40 hover:text-white/70"
              }`}
            >
              Issues
              {issues.length > 0 && (
                <span className="bg-orange-500/70 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center leading-none">
                  {issues.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setRightTab("todos")}
              className={`flex-1 py-2.5 text-xs font-bold tracking-[0.1em] uppercase transition-colors flex items-center justify-center gap-1 ${
                rightTab === "todos" ? "text-white border-b-2 border-white" : "text-white/40 hover:text-white/70"
              }`}
            >
              To Dos
              {todos.length > 0 && (
                <span className="bg-blue-500/70 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center leading-none">
                  {todos.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setRightTab("rocks")}
              className={`flex-1 py-2.5 text-xs font-bold tracking-[0.1em] uppercase transition-colors flex items-center justify-center gap-1 ${
                rightTab === "rocks" ? "text-white border-b-2 border-white" : "text-white/40 hover:text-white/70"
              }`}
            >
              Rocks
              {rocks.length > 0 && (
                <span className="bg-purple-500/70 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center leading-none">
                  {rocks.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setRightTab("scorecard")}
              className={`flex-1 py-2.5 text-xs font-bold tracking-[0.1em] uppercase transition-colors flex items-center justify-center gap-1 ${
                rightTab === "scorecard" ? "text-white border-b-2 border-white" : "text-white/40 hover:text-white/70"
              }`}
            >
              Score
              {scorecard.length > 0 && (
                <span className="bg-teal-500/70 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center leading-none">
                  {scorecard.length}
                </span>
              )}
            </button>
          </div>

          {/* ── Issues panel ── */}
          {rightTab === "issues" && (
            <>
              <div className="flex items-center justify-between px-2 mb-3">
                <p className="text-xs font-semibold tracking-[0.15em] text-white/30 uppercase flex items-center gap-1.5">
                  <AlertCircle className="w-3 h-3" /> Issues
                </p>
                <button
                  onClick={() => setShowAddForm((v) => !v)}
                  className="p-1 rounded-lg text-white/30 hover:text-white/70 hover:bg-white/10 transition-colors"
                  title="Add issue"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>

              {showAddForm && (
                <div className="mx-2 mb-3 bg-white/5 rounded-xl p-3 space-y-2 border border-white/10">
                  <input autoFocus type="text" placeholder="Issue title *" value={addForm.title}
                    onChange={(e) => setAddForm((f) => ({ ...f, title: e.target.value }))}
                    onKeyDown={(e) => e.key === "Enter" && handleAddIssue()}
                    className="w-full bg-transparent text-xs text-white placeholder:text-white/30 outline-none border-b border-white/10 pb-1" />
                  <input type="text" placeholder="Description" value={addForm.description}
                    onChange={(e) => setAddForm((f) => ({ ...f, description: e.target.value }))}
                    className="w-full bg-transparent text-xs text-white/60 placeholder:text-white/20 outline-none" />
                  <select value={addForm.owner}
                    onChange={(e) => setAddForm((f) => ({ ...f, owner: e.target.value }))}
                    className="w-full bg-[#1a1a1a] rounded text-xs text-white/90 outline-none px-2 py-1.5 timer-select">
                    <option value="">No owner</option>
                    {(agenda.team || []).map((m) => (
                      <option key={m.id} value={`${m.first_name} ${m.last_name}`.trim()}>
                        {m.first_name} {m.last_name}{m.title ? ` — ${m.title}` : ""}
                      </option>
                    ))}
                  </select>
                  <div className="flex gap-2 pt-1">
                    <button onClick={handleAddIssue} disabled={!addForm.title.trim()}
                      className="px-3 py-1 bg-white text-black text-xs font-semibold rounded-lg disabled:opacity-40 hover:bg-white/90 transition-colors">Add</button>
                    <button onClick={() => { setShowAddForm(false); setAddForm({ title: "", description: "", owner: "" }); }}
                      className="px-3 py-1 text-xs text-white/40 hover:text-white/70 transition-colors">Cancel</button>
                  </div>
                </div>
              )}

              {issues.length === 0 && !showAddForm && (
                <p className="text-xs text-white/20 px-2 mb-2">No open issues.</p>
              )}

              <DragDropContext onDragEnd={handleIssueReorder}>
                <Droppable droppableId="timer-issues">
                  {(provided) => (
                    <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-1.5 flex-1">
                      {issues.map((issue, idx) => (
                        <Draggable key={issue.id} draggableId={issue.id} index={idx}>
                          {(provided, snapshot) => (
                            <div ref={provided.innerRef} {...provided.draggableProps}
                              className={`rounded-xl p-2.5 border transition-all ${snapshot.isDragging ? "bg-white/15 border-white/20 shadow-xl" : "bg-white/5 border-white/5 hover:border-white/10"}`}>
                              {editingIssueId === issue.id ? (
                                <div className="space-y-1.5">
                                  <input autoFocus value={editForm.title} onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))}
                                    className="w-full bg-transparent text-xs text-white outline-none border-b border-white/20 pb-0.5" />
                                  <input value={editForm.description} onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                                    placeholder="Description" className="w-full bg-transparent text-xs text-white/50 outline-none placeholder:text-white/20" />
                                  <select value={editForm.owner} onChange={(e) => setEditForm((f) => ({ ...f, owner: e.target.value }))}
                                    className="w-full bg-[#1a1a1a] rounded text-xs text-white/90 outline-none px-2 py-1.5 timer-select">
                                    <option value="">No owner</option>
                                    {(agenda.team || []).map((m) => (
                                      <option key={m.id} value={`${m.first_name} ${m.last_name}`.trim()}>
                                        {m.first_name} {m.last_name}{m.title ? ` — ${m.title}` : ""}
                                      </option>
                                    ))}
                                  </select>
                                  <div className="flex gap-2 pt-0.5">
                                    <button onClick={handleSaveEdit} className="text-[10px] px-2 py-0.5 bg-white text-black rounded font-semibold hover:bg-white/90">Save</button>
                                    <button onClick={() => setEditingIssueId(null)} className="text-[10px] text-white/40 hover:text-white/70">Cancel</button>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex items-start gap-1.5">
                                  <div {...provided.dragHandleProps} className="mt-0.5 text-white/20 hover:text-white/50 cursor-grab flex-shrink-0">
                                    <GripVertical className="w-3 h-3" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs font-medium text-white/80 leading-snug">{issue.title}</p>
                                    {issue.description && <p className="text-[10px] text-white/40 leading-snug mt-0.5">{issue.description}</p>}
                                    {issue.owner && <p className="text-[10px] text-white/30 mt-0.5">{issue.owner}</p>}
                                  </div>
                                  <div className="flex flex-col gap-0.5 flex-shrink-0">
                                    <button onClick={() => handleMarkDone(issue.id)} title="Mark done" className="p-0.5 text-white/20 hover:text-emerald-400 transition-colors">
                                      <CheckCircle2 className="w-3 h-3" />
                                    </button>
                                    <button onClick={() => handleStartEdit(issue)} title="Edit" className="p-0.5 text-white/20 hover:text-blue-400 transition-colors">
                                      <Pencil className="w-3 h-3" />
                                    </button>
                                    <button onClick={() => handleDeleteIssue(issue.id)} title="Delete" className="p-0.5 text-white/20 hover:text-red-400 transition-colors">
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </DragDropContext>

              {issueActivity.length > 0 && (
                <div className="mt-4 px-2 border-t border-white/5 pt-3">
                  <p className="text-[10px] font-semibold tracking-[0.1em] text-white/20 uppercase mb-1.5">Activity</p>
                  <div className="space-y-0.5">
                    {issueActivity.map((a, i) => (
                      <p key={i} className="text-[10px] text-white/30 leading-snug">{a}</p>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* ── Rocks panel ── */}
          {rightTab === "rocks" && (
            <>
              <div className="flex items-center justify-between px-2 mb-3">
                <p className="text-xs font-semibold tracking-[0.15em] text-white/30 uppercase flex items-center gap-1.5">
                  Rocks
                </p>
                <button
                  onClick={() => setShowAddRockForm((v) => !v)}
                  className="p-1 rounded-lg text-white/30 hover:text-white/70 hover:bg-white/10 transition-colors"
                  title="Add rock"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>

              {showAddRockForm && (
                <div className="mx-2 mb-3 bg-white/5 rounded-xl p-3 space-y-2 border border-white/10">
                  <input autoFocus type="text" placeholder="Rock title *" value={addRockForm.title}
                    onChange={(e) => setAddRockForm((f) => ({ ...f, title: e.target.value }))}
                    onKeyDown={(e) => e.key === "Enter" && handleAddRock()}
                    className="w-full bg-transparent text-xs text-white placeholder:text-white/30 outline-none border-b border-white/10 pb-1" />
                  <select value={addRockForm.owner}
                    onChange={(e) => setAddRockForm((f) => ({ ...f, owner: e.target.value }))}
                    className="w-full bg-[#1a1a1a] rounded text-xs text-white/90 outline-none px-2 py-1.5 timer-select">
                    <option value="">No owner</option>
                    {(agenda.team || []).map((m) => (
                      <option key={m.id} value={`${m.first_name} ${m.last_name}`.trim()}>
                        {m.first_name} {m.last_name}{m.title ? ` — ${m.title}` : ""}
                      </option>
                    ))}
                  </select>
                  <div className="grid grid-cols-2 gap-1">
                    <input type="date" placeholder="Start" value={addRockForm.start_date}
                      onChange={(e) => setAddRockForm((f) => ({ ...f, start_date: e.target.value }))}
                      className="w-full bg-white/5 rounded text-xs text-white/60 outline-none px-1 py-0.5" />
                    <input type="date" placeholder="Due" value={addRockForm.due_date}
                      onChange={(e) => setAddRockForm((f) => ({ ...f, due_date: e.target.value }))}
                      className="w-full bg-white/5 rounded text-xs text-white/60 outline-none px-1 py-0.5" />
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => setAddRockForm((f) => ({ ...f, on_track: true }))}
                      className={`flex-1 py-0.5 text-[10px] font-semibold rounded transition-colors ${addRockForm.on_track ? "bg-emerald-500/30 text-emerald-300" : "text-white/30 hover:text-white/60"}`}>
                      On Track
                    </button>
                    <button onClick={() => setAddRockForm((f) => ({ ...f, on_track: false }))}
                      className={`flex-1 py-0.5 text-[10px] font-semibold rounded transition-colors ${!addRockForm.on_track ? "bg-red-500/30 text-red-300" : "text-white/30 hover:text-white/60"}`}>
                      Off Track
                    </button>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button onClick={handleAddRock} disabled={!addRockForm.title.trim()}
                      className="px-3 py-1 bg-white text-black text-xs font-semibold rounded-lg disabled:opacity-40 hover:bg-white/90 transition-colors">Add</button>
                    <button onClick={() => { setShowAddRockForm(false); setAddRockForm({ title: "", owner: "", start_date: "", due_date: "", on_track: true }); }}
                      className="px-3 py-1 text-xs text-white/40 hover:text-white/70 transition-colors">Cancel</button>
                  </div>
                </div>
              )}

              {rocks.length === 0 && !showAddRockForm && (
                <p className="text-xs text-white/20 px-2 mb-2">No rocks.</p>
              )}

              <div className="space-y-1.5 flex-1">
                {rocks.map((rock) => (
                  <div key={rock.id} className="rounded-xl p-2.5 bg-white/5 border border-white/5 hover:border-white/10 transition-all">
                    {editingRockId === rock.id ? (
                      <div className="space-y-1.5">
                        <input autoFocus value={editRockForm.title}
                          onChange={(e) => setEditRockForm((f) => ({ ...f, title: e.target.value }))}
                          className="w-full bg-white/10 rounded text-xs text-white px-2 py-1 outline-none border border-white/20"
                        />
                        <select value={editRockForm.owner}
                          onChange={(e) => setEditRockForm((f) => ({ ...f, owner: e.target.value }))}
                          className="w-full bg-[#1a1a1a] rounded text-xs text-white/90 outline-none px-2 py-1.5 timer-select">
                          <option value="">No owner</option>
                          {(agenda.team || []).map((m) => (
                            <option key={m.id} value={`${m.first_name} ${m.last_name}`.trim()}>
                              {m.first_name} {m.last_name}{m.title ? ` — ${m.title}` : ""}
                            </option>
                          ))}
                        </select>
                        <div className="grid grid-cols-2 gap-1">
                          <input type="date" value={editRockForm.start_date}
                            onChange={(e) => setEditRockForm((f) => ({ ...f, start_date: e.target.value }))}
                            className="w-full bg-white/5 rounded text-[10px] text-white/50 outline-none px-1 py-0.5"
                          />
                          <input type="date" value={editRockForm.due_date}
                            onChange={(e) => setEditRockForm((f) => ({ ...f, due_date: e.target.value }))}
                            className="w-full bg-white/5 rounded text-[10px] text-white/50 outline-none px-1 py-0.5"
                          />
                        </div>
                        <div className="flex gap-2 pt-0.5">
                          <button onClick={handleSaveEditRock} disabled={!editRockForm.title.trim()}
                            className="px-2 py-0.5 bg-white text-black text-[10px] font-semibold rounded disabled:opacity-40 hover:bg-white/90 transition-colors">Save</button>
                          <button onClick={() => setEditingRockId(null)}
                            className="text-[10px] text-white/40 hover:text-white/70 transition-colors">Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-start gap-1.5">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-white/80 leading-snug">{rock.title}</p>
                            {rock.owner && <p className="text-[10px] text-white/30 mt-0.5">{rock.owner}</p>}
                            {rock.due_date && <p className="text-[10px] text-white/20">Due {rock.due_date}</p>}
                          </div>
                          <div className="flex flex-col items-end gap-1 flex-shrink-0">
                            <button onClick={() => handleToggleRockOnTrack(rock.id)}
                              className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full transition-colors ${rock.on_track ? "bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30" : "bg-red-500/20 text-red-400 hover:bg-red-500/30"}`}>
                              {rock.on_track ? "On Track" : "Off Track"}
                            </button>
                            <div className="flex gap-0.5">
                              <button onClick={() => handleCompleteRock(rock.id)} title="Mark complete" className="p-0.5 text-white/20 hover:text-emerald-400 transition-colors">
                                <CheckCircle2 className="w-3 h-3" />
                              </button>
                              <button onClick={() => handleStartEditRock(rock)} title="Edit" className="p-0.5 text-white/20 hover:text-blue-400 transition-colors">
                                <Pencil className="w-3 h-3" />
                              </button>
                              <button onClick={() => handleDeleteRock(rock.id)} className="p-0.5 text-white/20 hover:text-red-400 transition-colors">
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        </div>
                        {(rock.milestones || []).length > 0 && (
                          <div className="mt-1.5 space-y-0.5">
                            {rock.milestones.map((m) => (
                              <p key={m.id} className={`text-[10px] ${m.done ? "text-white/20 line-through" : "text-white/40"}`}>
                                · {m.title}{m.due_date ? ` (${m.due_date})` : ""}
                              </p>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}

          {/* ── Scorecard panel ── */}
          {rightTab === "scorecard" && (
            <>
              <div className="flex items-center justify-between px-2 mb-3">
                <p className="text-xs font-semibold tracking-[0.15em] text-white/30 uppercase flex items-center gap-1.5">
                  <Target className="w-3 h-3" /> Scorecard
                </p>
                <button
                  onClick={() => setShowAddMetricForm((v) => !v)}
                  className="p-1 rounded-lg text-white/30 hover:text-white/70 hover:bg-white/10 transition-colors"
                  title="Add metric"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>

              {showAddMetricForm && (
                <div className="mx-2 mb-3 bg-white/5 rounded-xl p-3 space-y-2 border border-white/10">
                  <input autoFocus type="text" placeholder="Metric name *" value={addMetricForm.name}
                    onChange={(e) => setAddMetricForm((f) => ({ ...f, name: e.target.value }))}
                    onKeyDown={(e) => e.key === "Enter" && handleAddMetric()}
                    className="w-full bg-transparent text-xs text-white placeholder:text-white/30 outline-none border-b border-white/10 pb-1" />
                  <input type="text" placeholder="Description" value={addMetricForm.description}
                    onChange={(e) => setAddMetricForm((f) => ({ ...f, description: e.target.value }))}
                    className="w-full bg-transparent text-xs text-white/60 placeholder:text-white/20 outline-none" />
                  <div className="flex gap-1.5">
                    <input type="number" placeholder="Target" value={addMetricForm.target}
                      onChange={(e) => setAddMetricForm((f) => ({ ...f, target: e.target.value }))}
                      className="flex-1 bg-white/5 rounded text-xs text-white/60 placeholder:text-white/20 outline-none px-2 py-1" />
                    <input type="text" placeholder="Unit ($, %)" value={addMetricForm.unit}
                      onChange={(e) => setAddMetricForm((f) => ({ ...f, unit: e.target.value }))}
                      className="flex-1 bg-white/5 rounded text-xs text-white/60 placeholder:text-white/20 outline-none px-2 py-1" />
                  </div>
                  <select value={addMetricForm.owner}
                    onChange={(e) => setAddMetricForm((f) => ({ ...f, owner: e.target.value }))}
                    className="w-full bg-[#1a1a1a] rounded text-xs text-white/90 outline-none px-2 py-1.5 timer-select">
                    <option value="">No owner</option>
                    {(agenda.team || []).map((m) => (
                      <option key={m.id} value={`${m.first_name} ${m.last_name}`.trim()}>
                        {m.first_name} {m.last_name}{m.title ? ` — ${m.title}` : ""}
                      </option>
                    ))}
                  </select>
                  <div className="flex gap-1">
                    <button onClick={() => setAddMetricForm((f) => ({ ...f, higher_is_better: true }))}
                      className={`flex-1 py-0.5 text-[10px] font-semibold rounded transition-colors ${addMetricForm.higher_is_better ? "bg-emerald-500/30 text-emerald-300" : "text-white/30 hover:text-white/60"}`}>
                      Higher is better
                    </button>
                    <button onClick={() => setAddMetricForm((f) => ({ ...f, higher_is_better: false }))}
                      className={`flex-1 py-0.5 text-[10px] font-semibold rounded transition-colors ${!addMetricForm.higher_is_better ? "bg-red-500/30 text-red-300" : "text-white/30 hover:text-white/60"}`}>
                      Lower is better
                    </button>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button onClick={handleAddMetric} disabled={!addMetricForm.name.trim()}
                      className="px-3 py-1 bg-white text-black text-xs font-semibold rounded-lg disabled:opacity-40 hover:bg-white/90 transition-colors">Add</button>
                    <button onClick={() => { setShowAddMetricForm(false); setAddMetricForm({ name: "", description: "", owner: "", target: "", unit: "", higher_is_better: true }); }}
                      className="px-3 py-1 text-xs text-white/40 hover:text-white/70 transition-colors">Cancel</button>
                  </div>
                </div>
              )}

              {scorecard.length === 0 && !showAddMetricForm && (
                <p className="text-xs text-white/20 px-2 mb-2">No scorecard metrics.</p>
              )}

              <div className="space-y-1.5 flex-1">
                {scorecard.map((metric) => {
                  const history = [...(metric.history || [])].sort((a, b) => (a.date < b.date ? 1 : -1));
                  const latest = history[0];
                  const onTrack = latest
                    ? (metric.higher_is_better !== false ? latest.value >= metric.target : latest.value <= metric.target)
                    : null;
                  const expanded = expandedMetricId === metric.id;
                  return (
                    <div key={metric.id} className={`rounded-xl border transition-all ${onTrack === false ? "bg-red-500/10 border-red-500/30" : onTrack === true ? "bg-emerald-500/10 border-emerald-500/30" : "bg-white/5 border-white/5"}`}>
                      <button
                        onClick={() => setExpandedMetricId(expanded ? null : metric.id)}
                        className="w-full text-left p-2.5 flex items-start gap-1.5"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-white/80 leading-snug">{metric.name}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            {latest ? (
                              <span className={`text-[10px] font-semibold ${onTrack === false ? "text-red-400" : "text-emerald-400"}`}>
                                {latest.value}{metric.unit ? ` ${metric.unit}` : ""} / {metric.target}{metric.unit ? ` ${metric.unit}` : ""}
                              </span>
                            ) : (
                              <span className="text-[10px] text-white/30">Target: {metric.target}{metric.unit ? ` ${metric.unit}` : ""}</span>
                            )}
                          </div>
                          {metric.owner && <p className="text-[10px] text-white/40 mt-0.5">Owner: {metric.owner}</p>}
                        </div>
                        {onTrack === false && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-red-500/30 text-red-300 flex-shrink-0">Off</span>}
                        {onTrack === true && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/30 text-emerald-300 flex-shrink-0">On</span>}
                        <ChevronDown className={`w-3 h-3 text-white/30 flex-shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`} />
                      </button>

                      {expanded && (
                        <div className="px-2.5 pb-2.5 border-t border-white/5 pt-2 space-y-2">
                          {metric.description && <p className="text-[10px] text-white/40 leading-snug">{metric.description}</p>}
                          {metric.owner && <p className="text-[10px] text-white/30">Owner: {metric.owner}</p>}
                          <p className="text-[10px] text-white/30">Target: {metric.target}{metric.unit ? ` ${metric.unit}` : ""} ({metric.higher_is_better !== false ? "higher is better" : "lower is better"})</p>

                          {showLogFor === metric.id ? (
                            <div className="bg-white/5 rounded-lg p-2 space-y-1.5 border border-white/10">
                              <div className="flex gap-1.5 items-center">
                                <input type="date" value={logForm.date}
                                  onChange={(e) => setLogForm((f) => ({ ...f, date: e.target.value }))}
                                  className="flex-1 bg-white/5 rounded text-[10px] text-white/60 outline-none px-1.5 py-1" />
                                <input type="number" placeholder="Value" value={logForm.value}
                                  onChange={(e) => setLogForm((f) => ({ ...f, value: e.target.value }))}
                                  onKeyDown={(e) => e.key === "Enter" && handleLogScore(metric.id)}
                                  className="flex-1 bg-white/5 rounded text-[10px] text-white/60 placeholder:text-white/20 outline-none px-1.5 py-1" />
                              </div>
                              <div className="flex gap-1.5">
                                <button onClick={() => handleLogScore(metric.id)} disabled={logForm.value === ""}
                                  className="px-2 py-0.5 bg-white text-black text-[10px] font-semibold rounded disabled:opacity-40">Log</button>
                                <button onClick={() => { setShowLogFor(null); setLogForm({ date: new Date().toISOString().split("T")[0], value: "" }); }}
                                  className="text-[10px] text-white/40 hover:text-white/70">Cancel</button>
                              </div>
                            </div>
                          ) : (
                            <button onClick={() => { setShowLogFor(metric.id); setLogForm({ date: new Date().toISOString().split("T")[0], value: "" }); }}
                              className="flex items-center gap-1 text-[10px] text-white/40 hover:text-white/70 transition-colors">
                              <Plus className="w-3 h-3" /> Log weekly value
                            </button>
                          )}

                          {history.length > 0 && (
                            <div className="space-y-0.5 pt-1 border-t border-white/5">
                              <p className="text-[9px] font-semibold tracking-[0.1em] text-white/20 uppercase">History</p>
                              {history.slice(0, 8).map((h) => {
                                const met = metric.higher_is_better !== false ? h.value >= metric.target : h.value <= metric.target;
                                return (
                                  <div key={h.id} className="flex items-center gap-1.5 group">
                                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${met ? "bg-emerald-500" : "bg-red-500"}`} />
                                    <span className="text-[10px] text-white/50 w-20">{h.date}</span>
                                    <span className={`text-[10px] font-semibold ${met ? "text-emerald-400" : "text-red-400"}`}>{h.value}{metric.unit ? ` ${metric.unit}` : ""}</span>
                                    <button onClick={() => handleDeleteScore(metric.id, h.id)} className="opacity-0 group-hover:opacity-100 text-white/30 hover:text-red-400 transition-all ml-auto">
                                      <X className="w-2.5 h-2.5" />
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* ── Todos panel ── */}
          {rightTab === "todos" && (
            <>
              <div className="flex items-center justify-between px-2 mb-3">
                <p className="text-xs font-semibold tracking-[0.15em] text-white/30 uppercase flex items-center gap-1.5">
                  <CheckCircle2 className="w-3 h-3" /> To Dos
                </p>
                <button
                  onClick={() => setShowAddTodoForm((v) => !v)}
                  className="p-1 rounded-lg text-white/30 hover:text-white/70 hover:bg-white/10 transition-colors"
                  title="Add to do"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>

              {showAddTodoForm && (
                <div className="mx-2 mb-3 bg-white/5 rounded-xl p-3 space-y-2 border border-white/10">
                  <input autoFocus type="text" placeholder="To do title *" value={addTodoForm.title}
                    onChange={(e) => setAddTodoForm((f) => ({ ...f, title: e.target.value }))}
                    onKeyDown={(e) => e.key === "Enter" && handleAddTodo()}
                    className="w-full bg-transparent text-xs text-white placeholder:text-white/30 outline-none border-b border-white/10 pb-1" />
                  <input type="text" placeholder="Description" value={addTodoForm.description}
                    onChange={(e) => setAddTodoForm((f) => ({ ...f, description: e.target.value }))}
                    className="w-full bg-transparent text-xs text-white/60 placeholder:text-white/20 outline-none" />
                  <select value={addTodoForm.assignees}
                    onChange={(e) => setAddTodoForm((f) => ({ ...f, assignees: e.target.value }))}
                    className="w-full bg-[#1a1a1a] rounded text-xs text-white/90 outline-none px-2 py-1.5 timer-select">
                    <option value="">No assignee</option>
                    {(agenda.team || []).map((m) => (
                      <option key={m.id} value={`${m.first_name} ${m.last_name}`.trim()}>
                        {m.first_name} {m.last_name}{m.title ? ` — ${m.title}` : ""}
                      </option>
                    ))}
                  </select>
                  <div className="flex gap-2 pt-1">
                    <button onClick={handleAddTodo} disabled={!addTodoForm.title.trim()}
                      className="px-3 py-1 bg-white text-black text-xs font-semibold rounded-lg disabled:opacity-40 hover:bg-white/90 transition-colors">Add</button>
                    <button onClick={() => { setShowAddTodoForm(false); setAddTodoForm({ title: "", description: "", assignees: "" }); }}
                      className="px-3 py-1 text-xs text-white/40 hover:text-white/70 transition-colors">Cancel</button>
                  </div>
                </div>
              )}

              {todos.length === 0 && !showAddTodoForm && (
                <p className="text-xs text-white/20 px-2 mb-2">No open to dos.</p>
              )}

              <DragDropContext onDragEnd={handleTodoReorder}>
                <Droppable droppableId="timer-todos">
                  {(provided) => (
                    <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-1.5 flex-1">
                      {todos.map((todo, idx) => (
                        <Draggable key={todo.id} draggableId={todo.id} index={idx}>
                          {(provided, snapshot) => (
                            <div ref={provided.innerRef} {...provided.draggableProps}
                              className={`rounded-xl p-2.5 border transition-all ${snapshot.isDragging ? "bg-white/15 border-white/20 shadow-xl" : "bg-white/5 border-white/5 hover:border-white/10"}`}>
                              {editingTodoId === todo.id ? (
                                <div className="space-y-1.5">
                                  <input autoFocus value={editTodoForm.title} onChange={(e) => setEditTodoForm((f) => ({ ...f, title: e.target.value }))}
                                    className="w-full bg-transparent text-xs text-white outline-none border-b border-white/20 pb-0.5" />
                                  <input value={editTodoForm.description} onChange={(e) => setEditTodoForm((f) => ({ ...f, description: e.target.value }))}
                                    placeholder="Description" className="w-full bg-transparent text-xs text-white/50 outline-none placeholder:text-white/20" />
                                  <select value={editTodoForm.assignees} onChange={(e) => setEditTodoForm((f) => ({ ...f, assignees: e.target.value }))}
                                    className="w-full bg-[#1a1a1a] rounded text-xs text-white/90 outline-none px-2 py-1.5 timer-select">
                                    <option value="">No assignee</option>
                                    {(agenda.team || []).map((m) => (
                                      <option key={m.id} value={`${m.first_name} ${m.last_name}`.trim()}>
                                        {m.first_name} {m.last_name}{m.title ? ` — ${m.title}` : ""}
                                      </option>
                                    ))}
                                  </select>
                                  <div className="flex gap-2 pt-0.5">
                                    <button onClick={handleSaveEditTodo} className="text-[10px] px-2 py-0.5 bg-white text-black rounded font-semibold hover:bg-white/90">Save</button>
                                    <button onClick={() => setEditingTodoId(null)} className="text-[10px] text-white/40 hover:text-white/70">Cancel</button>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex items-start gap-1.5">
                                  <div {...provided.dragHandleProps} className="mt-0.5 text-white/20 hover:text-white/50 cursor-grab flex-shrink-0">
                                    <GripVertical className="w-3 h-3" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs font-medium text-white/80 leading-snug">{todo.title}</p>
                                    {todo.description && <p className="text-[10px] text-white/40 leading-snug mt-0.5">{todo.description}</p>}
                                    {todo.assignees && <p className="text-[10px] text-white/30 mt-0.5">{todo.assignees}</p>}
                                  </div>
                                  <div className="flex flex-col gap-0.5 flex-shrink-0">
                                    <button onClick={() => handleMarkTodoDone(todo.id)} title="Mark done" className="p-0.5 text-white/20 hover:text-emerald-400 transition-colors">
                                      <CheckCircle2 className="w-3 h-3" />
                                    </button>
                                    <button onClick={() => handleStartEditTodo(todo)} title="Edit" className="p-0.5 text-white/20 hover:text-blue-400 transition-colors">
                                      <Pencil className="w-3 h-3" />
                                    </button>
                                    <button onClick={() => handleDeleteTodo(todo.id)} title="Delete" className="p-0.5 text-white/20 hover:text-red-400 transition-colors">
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </DragDropContext>
            </>
          )}
        </div>
      </div>
    </div>
  );
}