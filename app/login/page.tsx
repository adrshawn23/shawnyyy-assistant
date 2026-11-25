"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    setLoading(false);
    if (res.ok) {
      router.push("/");
      router.refresh();
    } else {
      const d = await res.json();
      setError(d.error || "Sign-in failed");
    }
  };

  return (
    <div className="min-h-screen bg-[#050a0f] flex items-center justify-center p-8">
      <form onSubmit={submit} className="w-full max-w-sm bg-[#0a0f14] border border-[#1e3a4e] rounded-2xl p-8 space-y-6">
        <div>
          <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[#00f2ff] to-[#0066ff]">
            SHAWN
          </h1>
          <p className="text-xs text-[#1e3a4e] font-mono mt-1">COMPANY SIGN-IN</p>
        </div>
        <input
          type="email"
          placeholder="Company email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full bg-[#111820] border border-[#1e3a4e] p-3 rounded-xl text-[#00f2ff] font-mono focus:outline-none focus:border-[#00f2ff]"
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full bg-[#111820] border border-[#1e3a4e] p-3 rounded-xl text-[#00f2ff] font-mono focus:outline-none focus:border-[#00f2ff]"
          required
        />
        {error && <p className="text-red-400 text-xs font-mono">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-[#00f2ff] text-[#0a0f14] font-bold py-3 rounded-xl hover:bg-white transition-all disabled:opacity-50"
        >
          {loading ? "SIGNING IN..." : "SIGN IN"}
        </button>
      </form>
    </div>
  );
}
