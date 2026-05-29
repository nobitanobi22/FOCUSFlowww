"use client";
import { SessionEvent } from "@/types";

const TYPE_ICONS: Record<string, string> = {
  youtube: "▶",
  github:  "◈",
  article: "◎",
  pdf:     "◻",
  other:   "○",
};

function driftColor(score?: number) {
  if (score === undefined) return "border-slate-700";
  if (score < 0.3) return "border-emerald-600";
  if (score < 0.6) return "border-amber-500";
  return "border-red-500";
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function shortUrl(url: string) {
  try {
    const u = new URL(url);
    return (u.hostname + u.pathname).slice(0, 52) + (url.length > 60 ? "…" : "");
  } catch {
    return url.slice(0, 52);
  }
}

interface Props {
  events: SessionEvent[];
}

export default function ContentTimeline({ events }: Props) {
  if (!events.length) {
    return (
      <div className="text-slate-600 text-sm text-center py-8">
        No pages visited yet. Start browsing to see your session timeline.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 max-h-96 overflow-y-auto pr-1">
      {[...events].reverse().map((e) => {
        const score = e.drift_score;
        const scoreStr = score !== undefined ? `${Math.round(score * 100)}` : "—";

        return (
          <div
            key={e.id}
            className={`flex items-start gap-3 rounded-lg px-4 py-3 bg-slate-900 border-l-2 ${driftColor(score)}`}
          >
            <span className="text-slate-500 text-lg mt-0.5 w-5 shrink-0">
              {TYPE_ICONS[e.content_type || "other"] || "○"}
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <p className="text-slate-200 text-sm font-medium truncate">
                  {e.title || shortUrl(e.url)}
                </p>
                <span
                  className={`text-xs font-mono shrink-0 ${
                    score === undefined ? "text-slate-600" :
                    score < 0.3 ? "text-emerald-400" :
                    score < 0.6 ? "text-amber-400" : "text-red-400"
                  }`}
                >
                  {scoreStr}
                </span>
              </div>
              <p className="text-slate-500 text-xs truncate mt-0.5">{shortUrl(e.url)}</p>
              <p className="text-slate-600 text-xs mt-1">{formatTime(e.timestamp)}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
