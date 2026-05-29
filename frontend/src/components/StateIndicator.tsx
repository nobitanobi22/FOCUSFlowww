"use client";
import { SessionState } from "@/types";

const STATE_CONFIG: Record<
  SessionState,
  { label: string; icon: string; bg: string; text: string; ring: string }
> = {
  active:        { label: "Active",         icon: "●",  bg: "bg-slate-800",  text: "text-slate-300", ring: "ring-slate-600" },
  focused:       { label: "Focused",        icon: "✓",  bg: "bg-emerald-950",text: "text-emerald-400",ring: "ring-emerald-700" },
  drifting:      { label: "Drifting",       icon: "⚠",  bg: "bg-amber-950",  text: "text-amber-400", ring: "ring-amber-700" },
  deeply_drifted:{ label: "Off Topic",      icon: "✗",  bg: "bg-red-950",    text: "text-red-400",   ring: "ring-red-700" },
  recovered:     { label: "Recovered",      icon: "↩",  bg: "bg-sky-950",    text: "text-sky-400",   ring: "ring-sky-700" },
  completed:     { label: "Completed",      icon: "◆",  bg: "bg-violet-950", text: "text-violet-400",ring: "ring-violet-700" },
};

interface Props {
  state: SessionState;
  message?: string;
}

export default function StateIndicator({ state, message }: Props) {
  const cfg = STATE_CONFIG[state] || STATE_CONFIG.active;

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className={`inline-flex items-center gap-2 px-5 py-2 rounded-full ring-1 ${cfg.bg} ${cfg.ring}`}
      >
        <span className={`text-lg ${cfg.text}`}>{cfg.icon}</span>
        <span className={`text-sm font-semibold tracking-widest uppercase ${cfg.text}`}>
          {cfg.label}
        </span>
      </div>
      {message && (
        <p className="text-slate-400 text-sm text-center max-w-xs">{message}</p>
      )}
    </div>
  );
}
