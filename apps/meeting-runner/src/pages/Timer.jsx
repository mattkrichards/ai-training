import { useState, useEffect, useRef } from "react";
import { api as base44 } from "@/api/m365";
import { createPageUrl } from "@/utils";
import MeetingTimer from "@/components/timer/MeetingTimer";

export default function Timer() {
  const [agenda, setAgenda] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("id");
    if (id) {
      base44.entities.Agenda.filter({ id }).then((results) => {
        if (results.length > 0) setAgenda(results[0]);
        setLoading(false);
      });
    } else {
      setLoading(false);
    }
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0F0F0F] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  if (!agenda) {
    return (
      <div className="min-h-screen bg-[#0F0F0F] flex flex-col items-center justify-center gap-4">
        <p className="text-white/50 text-lg">No agenda found.</p>
        <a href={createPageUrl("Home")} className="text-white underline text-sm">
          Go back
        </a>
      </div>
    );
  }

  return <MeetingTimer agenda={agenda} />;
}