"use client";
import Link from "next/link";
import { SessionSummary } from "@/types";

function completionColor(score?: number) {
  if (score === undefined) return "text-slate-500";
  if (score > 0.7) return "text-emerald-400";
  if (score > 0.4) return "text-amber-400";
  return "text-red-400";
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface Props {
  session: SessionSummary;
}

export default function SessionCard({ session }: Props) {
  const completion = session.completion_score;
  const completionPct =
    completion !== undefined ? Math.round(completion * 100) : null;

  return (
    <Link
      href={`/sessions/${session.id}`}
      className="block bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 rounded-xl px-5 py-4 transition-all"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-slate-100 font-semibold truncate">{session.intent_raw}</p>
          <p className="text-slate-500 text-xs mt-1">{formatDate(session.started_at)}</p>
        </div>
        <div className="flex flex-col items-end shrink-0">
          {completionPct !== null && (
            <span className={`text-lg font-mono font-bold ${completionColor(completion)}`}>
              {completionPct}%
            </span>
          )}
          <span className="text-slate-600 text-xs">on topic</span>
        </div>
      </div>

      <div className="flex items-center gap-4 mt-3">
        {session.duration_minutes && (
          <span className="text-slate-500 text-xs">
            {session.duration_minutes} min
          </span>
        )}
        <span
          className={`text-xs px-2 py-0.5 rounded-full ${
            session.state === "completed"
              ? "bg-slate-800 text-slate-400"
              : session.state === "focused"
              ? "bg-emerald-950 text-emerald-400"
              : session.state === "drifting"
              ? "bg-amber-950 text-amber-400"
              : "bg-red-950 text-red-400"
          }`}
        >
          {session.state}
        </span>
      </div>
    </Link>
  );
}
