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
    <div className="min-h-screen bg-[#F7F6F3]">
      {view === "list" && (
        <AgendaList onNew={handleNew} onEdit={handleEdit} />
      )}
      {view === "build" && (
        <AgendaBuilder agenda={editingAgenda} defaultTeamId={newTeamId} onBack={handleBack} />
      )}
    </div>
  );
}