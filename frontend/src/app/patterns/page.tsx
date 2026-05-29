"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { PatternOut, MetricsSummary } from "@/types";
import PatternHeatmap from "@/components/PatternHeatmap";

export default function PatternsPage() {
  const router = useRouter();
  const [patterns, setPatterns] = useState<PatternOut | null>(null);
  const [summary, setSummary] = useState<MetricsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      api.getMetricsSummary(),
      api.getPatterns().catch(() => null),
    ]).then(([s, p]) => {
      setSummary(s);
      setPatterns(p);
    }).catch(() => router.push("/login"))
      .finally(() => setLoading(false));
  }, [router]);

  if (loading) {
    return <main className="min-h-screen flex items-center justify-center"><p className="text-slate-500 animate-pulse">Loading…</p></main>;
  }

  return (
    <main className="min-h-screen max-w-3xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold font-mono">Your Patterns</h1>
          <p className="text-slate-500 text-sm mt-0.5">How you actually learn</p>
        </div>
        <button onClick={() => router.push("/")} className="text-slate-500 hover:text-slate-300 text-sm">
          ← Home
        </button>
      </div>

      {/* Summary stats */}
      {summary && (
        <div className="grid grid-cols-4 gap-4 mb-8">
          {[
            { label: "Sessions", value: summary.total_sessions },
            { label: "Avg duration", value: `${Math.round(summary.avg_focus_duration)}m` },
            { label: "Avg on-topic", value: `${Math.round(summary.avg_completion_score * 100)}%` },
            { label: "Total pages", value: summary.total_events },
          ].map(({ label, value }) => (
            <div key={label} className="bg-slate-900 rounded-xl p-4 text-center">
              <p className="text-2xl font-mono font-bold text-slate-100">{value}</p>
              <p className="text-slate-500 text-xs mt-1">{label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Not enough data yet */}
      {!patterns && (
        <div className="bg-slate-900 rounded-xl p-8 text-center">
          <p className="text-slate-400 font-semibold mb-2">Not enough data yet</p>
          <p className="text-slate-600 text-sm">Complete 3+ sessions to unlock your learning patterns.</p>
          <button onClick={() => router.push("/")} className="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm transition-all">
            Start a session →
          </button>
        </div>
      )}

      {patterns && (
        <div className="flex flex-col gap-6">
          {/* Key insights */}
          <div className="grid grid-cols-2 gap-4">
            {[
              {
                label: "Focus before drift",
                value: patterns.avg_focus_duration_minutes
                  ? `${Math.round(patterns.avg_focus_duration_minutes)} min`
                  : "—",
                sub: "avg duration of focus before first drift",
                color: "text-indigo-400",
              },
              {
                label: "Best focus time",
                value: patterns.best_focus_hour !== undefined
                  ? `${patterns.best_focus_hour}:00`
                  : "—",
                sub: "hour of day with highest completion scores",
                color: "text-amber-400",
              },
              {
                label: "Topic completion",
                value: patterns.topic_completion_rate !== undefined
                  ? `${Math.round(patterns.topic_completion_rate * 100)}%`
                  : "—",
                sub: "sessions where you studied what you declared",
                color: "text-emerald-400",
              },
              {
                label: "Recovery rate",
                value: patterns.recovery_rate !== undefined
                  ? `${Math.round(patterns.recovery_rate * 100)}%`
                  : "—",
                sub: "times you returned to topic after drifting",
                color: "text-sky-400",
              },
            ].map(({ label, value, sub, color }) => (
              <div key={label} className="bg-slate-900 rounded-xl p-5">
                <p className="text-slate-500 text-xs uppercase tracking-wider mb-1">{label}</p>
                <p className={`text-3xl font-mono font-bold ${color}`}>{value}</p>
                <p className="text-slate-600 text-xs mt-2">{sub}</p>
              </div>
            ))}
          </div>

          {/* Heatmap */}
          <div className="bg-slate-900 rounded-xl p-5">
            <h2 className="text-slate-300 font-semibold mb-4">Focus Time Heatmap</h2>
            <PatternHeatmap bestFocusHour={patterns.best_focus_hour} />
          </div>

          {/* Velocity trend */}
          {patterns.velocity_trend !== undefined && (
            <div className="bg-slate-900 rounded-xl p-5">
              <h2 className="text-slate-300 font-semibold mb-2">Trend</h2>
              <p className={`text-2xl font-mono font-bold ${
                patterns.velocity_trend > 0 ? "text-emerald-400" : "text-red-400"
              }`}>
                {patterns.velocity_trend > 0 ? "↑" : "↓"} {Math.abs(Math.round(patterns.velocity_trend * 100))}%
              </p>
              <p className="text-slate-500 text-sm mt-1">
                {patterns.velocity_trend > 0
                  ? "Your focus quality is improving over recent sessions."
                  : "Your focus quality has declined slightly. Try shorter sessions."}
              </p>
            </div>
          )}
        </div>
      )}
    </main>
  );
}
