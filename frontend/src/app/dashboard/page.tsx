"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import DriftGauge from "@/components/DriftGauge";
import StateIndicator from "@/components/StateIndicator";
import ContentTimeline from "@/components/ContentTimeline";
import { useSessionWebSocket } from "@/lib/websocket";
import { api } from "@/lib/api";
import { SessionDetail, SessionState } from "@/types";

export default function DashboardPage() {
  const router = useRouter();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [session, setSession] = useState<SessionDetail | null>(null);
  const [ending, setEnding] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  const { update, connected } = useSessionWebSocket(sessionId);

  // Load active session from localStorage
  useEffect(() => {
    const id = localStorage.getItem("active_session_id");
    if (!id) { router.push("/"); return; }
    setSessionId(id);
    api.getSession(id)
      .then(setSession)
      .catch(() => { localStorage.removeItem("active_session_id"); router.push("/"); });
  }, [router]);

  // Poll session events every 10s to update timeline
  useEffect(() => {
    if (!sessionId) return;
    const interval = setInterval(() => {
      api.getSession(sessionId).then(setSession).catch(() => {});
    }, 10000);
    return () => clearInterval(interval);
  }, [sessionId]);

  // Elapsed timer
  useEffect(() => {
    if (!session) return;
    const start = new Date(session.started_at).getTime();
    const tick = setInterval(() => {
      setElapsed(Math.floor((Date.now() - start) / 1000));
    }, 1000);
    return () => clearInterval(tick);
  }, [session]);

  const liveState = (update?.state ?? session?.state ?? "active") as SessionState;
  const liveScore = update?.drift_score ?? session?.final_drift_score ?? 0;

  const formatElapsed = (s: number) =>
    `${String(Math.floor(s / 3600)).padStart(2, "0")}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  async function handleEnd() {
    if (!sessionId) return;
    setEnding(true);
    try {
      await api.endSession(sessionId);
      localStorage.removeItem("active_session_id");
      router.push(`/sessions/${sessionId}`);
    } catch {
      setEnding(false);
    }
  }

  if (!session) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="text-slate-500 animate-pulse">Loading session…</p>
      </main>
    );
  }

  const events = session.events || [];
  const driftedEvents = events.filter((e) => (e.drift_score ?? 0) >= 0.6).length;
  const focusedEvents = events.filter((e) => (e.drift_score ?? 1) < 0.3).length;

  return (
    <main className="min-h-screen flex flex-col">
      {/* Top bar */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-slate-900">
        <div>
          <span className="text-slate-500 text-xs uppercase tracking-wider">Learning</span>
          <h1 className="text-slate-100 font-semibold text-lg">{session.intent_raw}</h1>
        </div>
        <div className="flex items-center gap-4">
          <span className="font-mono text-slate-400 text-sm">{formatElapsed(elapsed)}</span>
          <span className={`text-xs px-2 py-1 rounded-full ${connected ? "bg-emerald-950 text-emerald-400" : "bg-slate-800 text-slate-500"}`}>
            {connected ? "● Live" : "○ Connecting"}
          </span>
          <button
            onClick={handleEnd}
            disabled={ending}
            className="px-4 py-2 bg-slate-800 hover:bg-red-950 hover:text-red-400 border border-slate-700 rounded-lg text-sm transition-all disabled:opacity-50"
          >
            {ending ? "Ending…" : "End Session"}
          </button>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 p-6">
        {/* Left: gauge + state */}
        <div className="lg:col-span-1 flex flex-col items-center gap-6">
          <DriftGauge score={liveScore} />
          <StateIndicator state={liveState} />

          {/* Session stats */}
          <div className="w-full grid grid-cols-3 gap-3 mt-2">
            {[
              { label: "Events", value: events.length },
              { label: "Focused", value: focusedEvents },
              { label: "Off topic", value: driftedEvents },
            ].map(({ label, value }) => (
              <div key={label} className="bg-slate-900 rounded-xl p-3 text-center">
                <p className="text-2xl font-mono font-bold text-slate-100">{value}</p>
                <p className="text-slate-500 text-xs mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          {/* Intent concepts */}
          {session.intent_expanded?.core_concepts && (
            <div className="w-full bg-slate-900 rounded-xl p-4">
              <p className="text-slate-500 text-xs uppercase tracking-wider mb-2">Core concepts</p>
              <div className="flex flex-wrap gap-1.5">
                {session.intent_expanded.core_concepts.map((c) => (
                  <span key={c} className="text-xs px-2 py-1 bg-indigo-950 text-indigo-300 rounded-md">
                    {c}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: timeline */}
        <div className="lg:col-span-2">
          <div className="bg-slate-900 rounded-xl p-5 h-full">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-slate-300 font-semibold">Content Timeline</h2>
              <span className="text-slate-600 text-xs">{events.length} pages visited</span>
            </div>
            <ContentTimeline events={events} />
          </div>
        </div>
      </div>
    </main>
  );
}
