"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { SessionDetail, DriftPoint } from "@/types";
import DriftCurve from "@/components/DriftCurve";
import ContentTimeline from "@/components/ContentTimeline";

export default function SessionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [session, setSession] = useState<SessionDetail | null>(null);
  const [curve, setCurve] = useState<DriftPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    Promise.all([api.getSession(id), api.getSessionCurve(id)])
      .then(([s, c]) => { setSession(s); setCurve(c); })
      .catch(() => router.push("/sessions"))
      .finally(() => setLoading(false));
  }, [id, router]);

  if (loading) {
    return <main className="min-h-screen flex items-center justify-center"><p className="text-slate-500 animate-pulse">Loading…</p></main>;
  }
  if (!session) return null;

  const completionPct = session.completion_score !== undefined
    ? Math.round(session.completion_score * 100) : null;

  const driftPct = session.final_drift_score !== undefined
    ? Math.round(session.final_drift_score * 100) : null;

  return (
    <main className="min-h-screen max-w-3xl mx-auto px-4 py-10">
      {/* Back */}
      <button onClick={() => router.push("/sessions")} className="text-slate-500 hover:text-slate-300 text-sm mb-6 flex items-center gap-1">
        ← Back to sessions
      </button>

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold">{session.intent_raw}</h1>
        <p className="text-slate-500 text-sm mt-1">
          {new Date(session.started_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
          {session.duration_minutes && ` · ${session.duration_minutes} min`}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-slate-900 rounded-xl p-4 text-center">
          <p className="text-3xl font-mono font-bold text-indigo-400">
            {completionPct !== null ? `${completionPct}%` : "—"}
          </p>
          <p className="text-slate-500 text-xs mt-1">on topic</p>
        </div>
        <div className="bg-slate-900 rounded-xl p-4 text-center">
          <p className="text-3xl font-mono font-bold text-slate-300">
            {session.events.length}
          </p>
          <p className="text-slate-500 text-xs mt-1">pages visited</p>
        </div>
        <div className="bg-slate-900 rounded-xl p-4 text-center">
          <p className="text-3xl font-mono font-bold text-slate-300">
            {session.transitions.length}
          </p>
          <p className="text-slate-500 text-xs mt-1">state changes</p>
        </div>
      </div>

      {/* Drift curve */}
      <section className="bg-slate-900 rounded-xl p-5 mb-6">
        <h2 className="text-slate-300 font-semibold mb-4">Drift Over Time</h2>
        <DriftCurve data={curve} />
        <div className="flex gap-4 mt-2 text-xs text-slate-600">
          <span className="flex items-center gap-1"><span className="text-emerald-500">—</span> Focused (&lt;30)</span>
          <span className="flex items-center gap-1"><span className="text-red-500">—</span> Off topic (&gt;60)</span>
        </div>
      </section>

      {/* State transitions */}
      {session.transitions.length > 0 && (
        <section className="bg-slate-900 rounded-xl p-5 mb-6">
          <h2 className="text-slate-300 font-semibold mb-4">State Trajectory</h2>
          <div className="flex flex-col gap-2">
            {session.transitions.map((t) => (
              <div key={t.id} className="flex items-center gap-3 text-sm">
                <span className="text-slate-600 font-mono text-xs w-16 shrink-0">
                  {new Date(t.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
                <span className="text-slate-500 line-through text-xs">{t.from_state}</span>
                <span className="text-slate-600">→</span>
                <span className={`font-semibold text-xs ${
                  t.to_state === "focused" || t.to_state === "recovered" ? "text-emerald-400" :
                  t.to_state === "drifting" ? "text-amber-400" :
                  t.to_state === "deeply_drifted" ? "text-red-400" : "text-slate-400"
                }`}>{t.to_state}</span>
                {t.drift_score !== undefined && (
                  <span className="text-slate-600 text-xs ml-auto font-mono">
                    {Math.round(t.drift_score * 100)}%
                  </span>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Content log */}
      <section className="bg-slate-900 rounded-xl p-5">
        <h2 className="text-slate-300 font-semibold mb-4">Content Log</h2>
        <ContentTimeline events={session.events} />
      </section>
    </main>
  );
}
