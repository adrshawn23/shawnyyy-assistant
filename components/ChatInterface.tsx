"use client";

import { useState } from "react";
import { Send, Bot, User } from "lucide-react";

interface Msg { role: "user" | "assistant"; content: string }

function summarize(data: any): string {
  if (data.error) return `Error: ${data.error}`;
  if (data.message) {
    let s = data.message;
    if (data.jobId) s += ` (job #${data.jobId})`;
    return s;
  }
  if (data.type === "formula" && data.formulas) {
    return data.formulas.map((f: any) =>
      f.steps.map((s: any) => `${s.pasteCell}: ${s.formula}`).join("\n")
    ).join("\n\n");
  }
  if (data.type === "job_status") {
    const st = data.status;
    if (Array.isArray(st)) return st.map((j: any) => `#${j.id} ${j.type} — ${j.status}`).join("\n") || "No jobs yet.";
    return JSON.stringify(st, null, 2);
  }
  if (data.status === "completed" && data.result) {
    const k = data.result.kpi?.totals;
    return `Done. Events: ${k?.events}, Shipments: ${k?.shipments}. Reconciliation: ${data.reconciliation?.ok ? "OK" : "FAILED"}.`;
  }
  if (data.status) return `Status: ${data.status}${data.message ? " — " + data.message : ""}`;
  return JSON.stringify(data, null, 2).slice(0, 2000);
}

export default function ChatInterface() {
  const [input, setInput] = useState("");
  const [workbookUrl, setWorkbookUrl] = useState("");
  const [messages, setMessages] = useState<Msg[]>([
    { role: "assistant", content: "Hi! I'm Shawn. Ask me to clean a sheet, build a hub report, find formulas, or just say \"what can you do\". (Demo mode uses sample data.)" },
  ]);
  const [busy, setBusy] = useState(false);

  const send = async () => {
    if (!input.trim() || busy) return;
    const text = input;
    setMessages((m) => [...m, { role: "user", content: text }]);
    setInput("");
    setBusy(true);
    try {
      const res = await fetch("/api/commands", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          command: text,
          workbookUrl: workbookUrl || undefined,
          history: messages.slice(-10).map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      const data: any = await res.json();
      const replyText: string = data.reply || summarize(data);
      setMessages((m) => [...m, { role: "assistant", content: replyText }]);
    } catch (e: any) {
      setMessages((m) => [...m, { role: "assistant", content: `Request failed: ${e?.message}` }]);
    }
    setBusy(false);
  };

  return (
    <div className="bg-[#0a0f14] p-6 rounded-2xl border border-[#1e3a4e] shadow-[0_0_20px_rgba(0,150,255,0.1)] h-[560px] flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold tracking-widest text-[#00f2ff] uppercase">Shawn Terminal</h3>
        <input
          value={workbookUrl}
          onChange={(e) => setWorkbookUrl(e.target.value)}
          placeholder="Workbook URL (optional in demo)"
          className="bg-[#111820] border border-[#1e3a4e] px-3 py-1 rounded-lg text-[#00f2ff] text-xs font-mono w-64 focus:outline-none focus:border-[#00f2ff]"
        />
      </div>
      <div className="flex-1 overflow-y-auto mb-4 space-y-4">
        {messages.map((m, i) => (
          <div key={i} className={`flex items-start gap-3 ${m.role === "user" ? "justify-end" : ""}`}>
            {m.role === "assistant" && <Bot className="w-6 h-6 text-[#00f2ff] shrink-0" />}
            <div className={`p-3 rounded-lg max-w-[85%] text-sm font-mono whitespace-pre-wrap ${m.role === "user" ? "bg-[#1e3a4e] text-white" : "bg-[#111820] text-[#00f2ff]"}`}>
              {m.content}
            </div>
            {m.role === "user" && <User className="w-6 h-6 text-zinc-500 shrink-0" />}
          </div>
        ))}
        {busy && <div className="text-[#1e3a4e] text-xs font-mono pl-9">SHAWN PROCESSING...</div>}
      </div>
      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="Message Shawn..."
          className="flex-1 bg-[#111820] border border-[#1e3a4e] p-3 rounded-xl text-[#00f2ff] font-mono focus:outline-none focus:border-[#00f2ff]"
        />
        <button onClick={send} disabled={busy} className="bg-[#00f2ff] text-[#0a0f14] p-3 rounded-xl hover:bg-white transition-all disabled:opacity-50">
          <Send className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
