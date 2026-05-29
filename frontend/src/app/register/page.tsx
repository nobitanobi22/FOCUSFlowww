"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, setToken } from "@/lib/api";

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleRegister() {
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    setLoading(true);
    setError("");
    try {
      const res = await api.register(email, password);
      setToken(res.access_token);
      localStorage.setItem("user_id", res.user_id);
      localStorage.setItem("email", res.email);
      router.push("/");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold font-mono">
            Focus<span className="text-indigo-400">Flow</span>
          </h1>
          <p className="text-slate-500 text-sm mt-2">Create your account</p>
        </div>

        <div className="flex flex-col gap-3">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="bg-slate-900 border border-slate-700 focus:border-indigo-500 rounded-xl px-4 py-3 text-slate-100 placeholder-slate-600 outline-none transition-colors"
          />
          <input
            type="password"
            placeholder="Password (8+ characters)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleRegister()}
            className="bg-slate-900 border border-slate-700 focus:border-indigo-500 rounded-xl px-4 py-3 text-slate-100 placeholder-slate-600 outline-none transition-colors"
          />

          {error && <p className="text-red-400 text-sm text-center">{error}</p>}

          <button
            onClick={handleRegister}
            disabled={loading || !email || !password}
            className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-semibold transition-all"
          >
            {loading ? "Creating account…" : "Create Account"}
          </button>

          <p className="text-center text-slate-500 text-sm">
            Already have an account?{" "}
            <Link href="/login" className="text-indigo-400 hover:text-indigo-300">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
