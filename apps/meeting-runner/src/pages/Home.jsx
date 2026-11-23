import { useState } from "react";
import { createPageUrl } from "@/utils";
import AgendaList from "@/components/agenda/AgendaList";
import AgendaBuilder from "@/components/agenda/AgendaBuilder";

export default function Home() {
  const [view, setView] = useState("list"); // "list" | "build"
  const [editingAgenda, setEditingAgenda] = useState(null);
  const [newTeamId, setNewTeamId] = useState("");

  const handleEdit = (agenda) => {
    setEditingAgenda(agenda);
    setView("build");
  };

  const handleNew = (teamId = "") => {
    setNewTeamId(teamId || "");
    setEditingAgenda(null);
    setView("build");
  };

  const handleBack = () => {
    setEditingAgenda(null);
    setView("list");
  };

  return (
    <div className="min-h-screen bg-rs-bg">
      {/* Richards brand bar */}
      <header className="bg-rs-charcoal border-b-[3px] border-rs-red">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <a href={import.meta.env.BASE_URL} className="flex items-center gap-4">
            <img src={`${import.meta.env.BASE_URL}brand/rs-logo-horizontal-white.png`} alt="Richards Supply Company" className="h-6 w-auto" />
            <span className="hidden sm:block h-5 w-px bg-white/20" />
            <span className="hidden sm:block font-heading text-sm font-bold tracking-wide text-white">MeetingRunner</span>
          </a>
          <a href="/" className="text-xs text-rs-slate-light hover:text-white transition-colors">Hub</a>
        </div>
      </header>
      {view === "list" && (
        <AgendaList onNew={handleNew} onEdit={handleEdit} />
      )}
      {view === "build" && (
        <AgendaBuilder agenda={editingAgenda} defaultTeamId={newTeamId} onBack={handleBack} />
      )}
    </div>
  );
}