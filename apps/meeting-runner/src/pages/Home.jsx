import { useState } from "react";
import { createPageUrl } from "@/utils";
import AgendaList from "@/components/agenda/AgendaList";
import AgendaBuilder from "@/components/agenda/AgendaBuilder";

export default function Home() {
  const [view, setView] = useState("list"); // "list" | "build"
  const [editingAgenda, setEditingAgenda] = useState(null);

  const handleEdit = (agenda) => {
    setEditingAgenda(agenda);
    setView("build");
  };

  const handleNew = () => {
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
        <AgendaBuilder agenda={editingAgenda} onBack={handleBack} />
      )}
    </div>
  );
}