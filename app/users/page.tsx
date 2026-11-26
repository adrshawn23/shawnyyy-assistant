"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Account { id: number; email: string; name: string | null; role: string; createdAt: string }

export default function UsersPage() {
  const [users, setUsers] = useState<Account[]>([]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState("user");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);

  const load = async () => {
    const res = await fetch("/api/users");
    const data = await res.json();
    if (data.users) setUsers(data.users);
  };

  useEffect(() => { load(); }, []);

  const addUser = async () => {
    setLoading(true);
    setNotice("");
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, name, role }),
    });
    const data = await res.json();
    setNotice(data.error || `Account created: ${data.user?.email}`);
    if (data.user) { setEmail(""); setPassword(""); setName(""); load(); }
    setLoading(false);
  };

  const removeUser = async (id: number) => {
    if (!confirm("Delete this account?")) return;
    await fetch(`/api/users?id=${id}`, { method: "DELETE" });
    load();
  };

  return (
    <main className="min-h-screen bg-[#0a0f14] text-white p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-[#00f2ff]">ACCOUNTS</h1>
          <Link href="/" className="text-xs font-mono text-zinc-400 hover:text-white">← BACK TO CHAT</Link>
        </div>

        <div className="bg-[#111820] border border-[#1e3a4e] rounded-2xl p-5 space-y-3">
          <div className="text-xs font-mono text-zinc-400">ADD ACCOUNT</div>
          <div className="grid grid-cols-2 gap-3">
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@company.com" className="bg-[#0a0f14] border border-[#1e3a4e] rounded-lg px-3 py-2 text-sm font-mono" />
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="name (optional)" className="bg-[#0a0f14] border border-[#1e3a4e] rounded-lg px-3 py-2 text-sm font-mono" />
            <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="password (min 6)" className="bg-[#0a0f14] border border-[#1e3a4e] rounded-lg px-3 py-2 text-sm font-mono" />
            <select value={role} onChange={(e) => setRole(e.target.value)} className="bg-[#0a0f14] border border-[#1e3a4e] rounded-lg px-3 py-2 text-sm font-mono">
              <option value="user">user</option>
              <option value="admin">admin</option>
            </select>
          </div>
          <button onClick={addUser} disabled={loading} className="bg-[#00f2ff] text-[#0a0f14] font-bold text-sm px-5 py-2 rounded-lg hover:bg-white transition-all disabled:opacity-50">
            {loading ? "ADDING..." : "ADD ACCOUNT"}
          </button>
          {notice && <div className="text-xs font-mono text-[#00f2ff]">{notice}</div>}
        </div>

        <div className="bg-[#111820] border border-[#1e3a4e] rounded-2xl p-5 space-y-2">
          <div className="text-xs font-mono text-zinc-400">EXISTING ACCOUNTS ({users.length})</div>
          {users.map((u) => (
            <div key={u.id} className="flex items-center justify-between bg-[#0a0f14] rounded-lg px-3 py-2">
              <div>
                <div className="text-sm font-mono">{u.email}</div>
                <div className="text-[10px] font-mono text-zinc-500">{u.name || "—"} · {u.role}</div>
              </div>
              <button onClick={() => removeUser(u.id)} className="text-[10px] font-mono text-red-400 hover:text-red-300">DELETE</button>
            </div>
          ))}
          {users.length === 0 && <div className="text-xs font-mono text-zinc-500">No accounts yet — the shared login still works.</div>}
        </div>
      </div>
    </main>
  );
}
