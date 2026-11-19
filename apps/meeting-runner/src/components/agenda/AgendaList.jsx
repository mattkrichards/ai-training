import { useState, useEffect, useRef } from "react";
import { api as base44 } from "@/api/m365";
import { createPageUrl } from "@/utils";
import { Upload, LogOut, Plus, Play, Pencil, Trash2, Clock, Calendar, AlertCircle, ListTodo, Mountain, Target, Users } from "lucide-react";
import IssueTracker from "./IssueTracker";
import TodoTracker from "./TodoTracker";
import RockTracker from "./RockTracker";
import ScorecardTracker from "./ScorecardTracker";
import TeamTracker from "./TeamTracker";
import { readAgendaFile } from "@/lib/importAgendas";
import { useAuth } from "@/lib/AuthContext";

export default function AgendaList({ onNew, onEdit }) {
  const [agendas, setAgendas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [issuesAgenda, setIssuesAgenda] = useState(null);
  const [todosAgenda, setTodosAgenda] = useState(null);
  const [rocksAgenda, setRocksAgenda] = useState(null);
  const [scorecardAgenda, setScorecardAgenda] = useState(null);
  const [teamAgenda, setTeamAgenda] = useState(null);

  const { user, logout } = useAuth();
  const fileRef = useRef(null);
  const [importMsg, setImportMsg] = useState("");
  const [loadError, setLoadError] = useState("");

  const load = async () => {
    try {
      const data = await base44.entities.Agenda.list("-created_date");
      setAgendas(data);
      setLoadError("");
    } catch (e) {
      console.error(e);
      setLoadError(e.message || "Couldn't load agendas.");
    }
    setLoading(false);
  };

  const handleImport = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      setImportMsg("Importing…");
      const records = await readAgendaFile(file);
      for (const rec of records) await base44.entities.Agenda.create(rec, { keepId: true });
      setImportMsg(`Imported ${records.length} agenda${records.length === 1 ? "" : "s"}.`);
      await load();
    } catch (err) {
      console.error(err);
      setImportMsg(`Import failed: ${err.message}`);
    }
    setTimeout(() => setImportMsg(""), 6000);
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async (id) => {
    await base44.entities.Agenda.delete(id);
    setAgendas((prev) => prev.filter((a) => a.id !== id));
  };

  const totalTime = (items = []) =>
    items.reduce((sum, item) => sum + (item.duration || 0), 0);

  return (
    <div className="max-w-5xl mx-auto px-6 py-16">
      {/* Header */}
      <div className="flex items-end justify-between mb-12">
        <div>
          <p className="text-xs font-semibold tracking-[0.2em] text-neutral-400 uppercase mb-2">Meeting Planner</p>
          <h1 className="text-4xl font-bold text-neutral-900 tracking-tight">Agendas</h1>
        </div>
        <div className="flex items-center gap-2">
        <input ref={fileRef} type="file" accept=".csv,.json" className="hidden" onChange={handleImport} />
        <button
          onClick={() => fileRef.current?.click()}
          title="Import agendas exported from Base44 (CSV or JSON)"
          className="flex items-center gap-2 px-4 py-2.5 text-neutral-600 text-sm font-medium rounded-xl border border-neutral-200 bg-white hover:bg-neutral-50 transition-colors"
        >
          <Upload className="w-4 h-4" />
          Import
        </button>
        <button
          onClick={onNew}
          className="flex items-center gap-2 px-5 py-2.5 bg-neutral-900 text-white text-sm font-medium rounded-xl hover:bg-neutral-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Agenda
        </button>
        </div>
      </div>

      {user && (
        <div className="-mt-8 mb-10 flex items-center gap-3 text-xs text-neutral-400">
          <span>Signed in as {user.full_name || user.email}</span>
          <button onClick={() => logout()} className="flex items-center gap-1 hover:text-neutral-700 transition-colors">
            <LogOut className="w-3 h-3" /> Sign out
          </button>
          {importMsg && <span className="ml-auto text-neutral-600">{importMsg}</span>}
        </div>
      )}

      {loadError && (
        <div className="mb-8 p-4 rounded-xl border border-red-200 bg-red-50 text-sm text-red-700 break-words">
          {loadError}
        </div>
      )}

      {loading && (
        <div className="flex justify-center py-20">
          <div className="w-6 h-6 border-2 border-neutral-200 border-t-neutral-500 rounded-full animate-spin" />
        </div>
      )}

      {!loading && agendas.length === 0 && (
        <div className="text-center py-24">
          <div className="w-16 h-16 bg-neutral-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Calendar className="w-7 h-7 text-neutral-400" />
          </div>
          <p className="text-neutral-500 text-base mb-1">No agendas yet</p>
          <p className="text-neutral-400 text-sm">Create your first meeting agenda to get started</p>
        </div>
      )}

      {issuesAgenda && (
        <IssueTracker agenda={issuesAgenda} onClose={() => setIssuesAgenda(null)} />
      )}
      {todosAgenda && (
        <TodoTracker agenda={todosAgenda} onClose={() => setTodosAgenda(null)} />
      )}
      {rocksAgenda && (
        <RockTracker agenda={rocksAgenda} onClose={() => setRocksAgenda(null)} />
      )}
      {scorecardAgenda && (
        <ScorecardTracker agenda={scorecardAgenda} onClose={() => setScorecardAgenda(null)} />
      )}
      {teamAgenda && (
        <TeamTracker agenda={teamAgenda} onClose={() => setTeamAgenda(null)} />
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {agendas.map((agenda) => {
          const mins = totalTime(agenda.items);
          const itemCount = (agenda.items || []).length;
          const openIssues = (agenda.issues || []).filter((i) => !i.deleted && !i.done).length;
          const openTodos = (agenda.todos || []).filter((t) => !t.deleted && !t.done).length;
          const openRocks = (agenda.rocks || []).filter((r) => !r.deleted).length;
          const metricCount = (agenda.scorecard || []).length;
          const teamCount = (agenda.team || []).length;
          return (
            <div
              key={agenda.id}
              className="group bg-white rounded-2xl border border-neutral-100 p-5 hover:border-neutral-200 hover:shadow-md transition-all flex flex-col"
            >
              <h2 className="text-base font-semibold text-neutral-900 leading-snug">{agenda.title}</h2>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-2">
                <span className="text-xs text-neutral-400 flex items-center gap-1">
                  <Clock className="w-3 h-3" /> {mins}m
                </span>
                <span className="text-xs text-neutral-300">•</span>
                <span className="text-xs text-neutral-400">{itemCount} item{itemCount !== 1 ? "s" : ""}</span>
                {openIssues > 0 && <span className="text-xs text-orange-500 font-medium">{openIssues} issue{openIssues !== 1 ? "s" : ""}</span>}
                {openTodos > 0 && <span className="text-xs text-blue-500 font-medium">{openTodos} to do{openTodos !== 1 ? "s" : ""}</span>}
                {openRocks > 0 && <span className="text-xs text-purple-500 font-medium">{openRocks} rock{openRocks !== 1 ? "s" : ""}</span>}
                {metricCount > 0 && <span className="text-xs text-teal-500 font-medium">{metricCount} metric{metricCount !== 1 ? "s" : ""}</span>}
                {teamCount > 0 && <span className="text-xs text-indigo-500 font-medium">{teamCount} member{teamCount !== 1 ? "s" : ""}</span>}
              </div>

              <div className="flex flex-wrap items-center gap-1.5 mt-4 pt-3 border-t border-neutral-50">
                <button onClick={() => setIssuesAgenda(agenda)} title="Issues" className="p-2 text-neutral-400 hover:text-orange-500 hover:bg-orange-50 rounded-lg transition-colors">
                  <AlertCircle className="w-4 h-4" />
                </button>
                <button onClick={() => setTodosAgenda(agenda)} title="To Dos" className="p-2 text-neutral-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors">
                  <ListTodo className="w-4 h-4" />
                </button>
                <button onClick={() => setRocksAgenda(agenda)} title="Rocks" className="p-2 text-neutral-400 hover:text-purple-500 hover:bg-purple-50 rounded-lg transition-colors">
                  <Mountain className="w-4 h-4" />
                </button>
                <button onClick={() => setScorecardAgenda(agenda)} title="Scorecard" className="p-2 text-neutral-400 hover:text-teal-500 hover:bg-teal-50 rounded-lg transition-colors">
                  <Target className="w-4 h-4" />
                </button>
                <button onClick={() => setTeamAgenda(agenda)} title="Team" className="p-2 text-neutral-400 hover:text-indigo-500 hover:bg-indigo-50 rounded-lg transition-colors">
                  <Users className="w-4 h-4" />
                </button>
                <div className="flex-1" />
                <button onClick={() => onEdit(agenda)} className="p-2 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-50 rounded-lg transition-colors">
                  <Pencil className="w-4 h-4" />
                </button>
                <button onClick={() => handleDelete(agenda.id)} className="p-2 text-neutral-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
                <a
                  href={`${createPageUrl("Timer")}?id=${agenda.id}`}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-500 text-white text-sm font-medium rounded-xl hover:bg-emerald-600 transition-colors ml-1"
                >
                  <Play className="w-3.5 h-3.5 fill-white" />
                  Run
                </a>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}