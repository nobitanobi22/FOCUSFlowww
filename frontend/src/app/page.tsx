"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { api, clearToken } from "@/lib/api";

const DURATIONS = [
  { label: "30 min", value: 30 },
  { label: "1 hr",   value: 60 },
  { label: "2 hr",   value: 120 },
  { label: "3 hr",   value: 180 },
];

export default function HomePage() {
  const router = useRouter();
  const [intent, setIntent] = useState("");
  const [duration, setDuration] = useState(60);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [recentIntents, setRecentIntents] = useState<string[]>([]);

  useEffect(() => {
    // Check auth
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/login");
      return;
    }
    // Load recent intents from localStorage
    const stored = localStorage.getItem("recent_intents");
    if (stored) setRecentIntents(JSON.parse(stored));
  }, [router]);

  async function handleStart() {
    if (!intent.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await api.startSession(intent.trim(), duration);
      // Save session id
      localStorage.setItem("active_session_id", res.session_id);
      // Tell the extension about the active session
      //chrome.storage?.local?.set({ 
        //session_id: res.session_id,
        //token: localStorage.getItem("token"),
        //intent_raw: intent.trim()
      //});
      // Save recent intents
      const updated = [intent, ...recentIntents.filter((i) => i !== intent)].slice(0, 5);
      localStorage.setItem("recent_intents", JSON.stringify(updated));
      router.push("/dashboard");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4">
      {/* Header */}
      <div className="flex items-center justify-between w-full max-w-xl mb-16">
        <div>
          <h1 className="text-2xl font-bold font-mono tracking-tight">
            Focus<span className="text-indigo-400">Flow</span>
          </h1>
          <p className="text-slate-500 text-xs mt-0.5">learning session analytics</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => router.push("/sessions")}
            className="text-slate-400 hover:text-slate-200 text-sm transition-colors"
          >
            History
          </button>
          <button
            onClick={() => router.push("/patterns")}
            className="text-slate-400 hover:text-slate-200 text-sm transition-colors"
          >
            Patterns
          </button>
          <button
            onClick={() => { clearToken(); router.push("/login"); }}
            className="text-slate-600 hover:text-slate-400 text-sm transition-colors"
          >
            Sign out
          </button>
        </div>
      </div>

      {/* Main card */}
      <div className="w-full max-w-xl">
        <h2 className="text-3xl font-bold text-center mb-2">
          What are you learning today?
        </h2>
        <p className="text-slate-500 text-sm text-center mb-8">
          Declare your intent. FocusFlow will show you in real time how close your browsing is to your goal.
        </p>

        {/* Intent input */}
        <textarea
          value={intent}
          onChange={(e) => setIntent(e.target.value)}
          placeholder="e.g. Learn Apache Kafka, Understand React hooks, Study calculus..."
          rows={3}
          className="w-full bg-slate-900 border border-slate-700 focus:border-indigo-500 rounded-xl px-4 py-3 text-slate-100 placeholder-slate-600 resize-none outline-none transition-colors text-lg"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleStart(); }
          }}
        />

        {/* Duration selector */}
        <div className="flex gap-2 mt-3">
          {DURATIONS.map((d) => (
            <button
              key={d.value}
              onClick={() => setDuration(d.value)}
              className={`flex-1 py-2 rounded-lg text-sm font-mono transition-all border ${
                duration === d.value
                  ? "bg-indigo-600 border-indigo-500 text-white"
                  : "bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500"
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>

        {error && (
          <p className="text-red-400 text-sm mt-3 text-center">{error}</p>
        )}

        {/* Start button */}
        <button
          onClick={handleStart}
          disabled={loading || !intent.trim()}
          className="w-full mt-4 py-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-lg transition-all"
        >
          {loading ? "Starting session…" : "Start Session →"}
        </button>

        {/* Recent intents */}
        {recentIntents.length > 0 && (
          <div className="mt-8">
            <p className="text-slate-600 text-xs mb-2 uppercase tracking-wider">Recent</p>
            <div className="flex flex-wrap gap-2">
              {recentIntents.map((i) => (
                <button
                  key={i}
                  onClick={() => setIntent(i)}
                  className="text-sm px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-slate-400 hover:text-slate-200 transition-all"
                >
                  {i}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
