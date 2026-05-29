"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { SessionSummary } from "@/types";
import SessionCard from "@/components/SessionCard";

export default function SessionsPage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.listSessions().then(setSessions).catch(() => router.push("/login")).finally(() => setLoading(false));
  }, [router]);

  return (
    <main className="min-h-screen max-w-2xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold font-mono">Session History</h1>
          <p className="text-slate-500 text-sm mt-0.5">{sessions.length} sessions</p>
        </div>
        <button
          onClick={() => router.push("/")}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm transition-all"
        >
          + New Session
        </button>
      </div>

      {loading ? (
        <p className="text-slate-600 animate-pulse text-center py-16">Loading…</p>
      ) : sessions.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-slate-500">No sessions yet.</p>
          <button onClick={() => router.push("/")} className="mt-4 text-indigo-400 hover:text-indigo-300 text-sm">
            Start your first session →
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {sessions.map((s) => <SessionCard key={s.id} session={s} />)}
        </div>
      )}
    </main>
  );
}
