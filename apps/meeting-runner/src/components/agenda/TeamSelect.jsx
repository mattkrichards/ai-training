// Owner picker fed by the agenda's team members. Keeps an older free-text owner
// (e.g. from Base44) selectable so editing an item doesn't silently clear it.
import { memberName } from "@/lib/team";
export { memberName };

export default function TeamSelect({ team = [], value = "", onChange, emptyLabel = "No owner", className = "" }) {
  const names = team.map(memberName).filter(Boolean);
  const hasLegacy = value && !names.includes(value);
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={className || "w-full text-xs text-neutral-700 bg-white rounded-lg border border-neutral-200 px-2 py-1.5 outline-none"}
    >
      <option value="">{team.length ? emptyLabel : `${emptyLabel} (add teammates in Team)`}</option>
      {hasLegacy && <option value={value}>{value}</option>}
      {team.map((m) => (
        <option key={m.id} value={memberName(m)}>
          {memberName(m)}{m.title ? ` — ${m.title}` : ""}
        </option>
      ))}
    </select>
  );
}
