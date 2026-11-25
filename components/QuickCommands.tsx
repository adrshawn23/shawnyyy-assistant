"use client";

import { useState } from "react";
import { Zap } from "lucide-react";

const QUICK = [
  "clean this raw data and build this week's hub report",
  "show job status",
  "find latest matching entry",
  "Shawn, remember this process",
];

export default function QuickCommands() {
  const [msg, setMsg] = useState("");
  const run = async (cmd: string) => {
    setMsg(`Running: ${cmd}`);
    const res = await fetch("/api/commands", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ command: cmd }),
    });
    const data = await res.json();
    setMsg(data.message || data.error || `Status: ${data.status}`);
  };
  return (
    <div className="bg-[#0a0f14] p-6 rounded-2xl border border-[#1e3a4e]">
      <div className="flex items-center gap-2 mb-4">
        <Zap className="w-5 h-5 text-[#00f2ff]" />
        <h3 className="text-sm font-bold tracking-widest text-[#00f2ff] uppercase">Quick Commands</h3>
      </div>
      <div className="flex flex-col gap-2">
        {QUICK.map((c) => (
          <button
            key={c}
            onClick={() => run(c)}
            className="text-left text-xs font-mono text-zinc-400 hover:text-[#00f2ff] border border-[#1e3a4e] rounded-lg px-3 py-2 hover:border-[#00f2ff] transition-all"
          >
            {c}
          </button>
        ))}
      </div>
      {msg && <p className="mt-4 text-[11px] font-mono text-[#00f2ff]">{msg}</p>}
    </div>
  );
}
