"use client";

import { useState } from "react";

export default function RulesManager({ rules, corrections, workflows }: { rules: any[]; corrections: any[]; workflows: any[] }) {
  const [msg, setMsg] = useState("");

  const ruleAction = async (ruleId: number, action: string) => {
    await fetch("/api/rules", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ruleId, action }),
    });
    setMsg(`Rule #${ruleId}: ${action}d`);
    setTimeout(() => location.reload(), 800);
  };

  const resolveCorrection = async (correctionId: number, resolution: string) => {
    await fetch("/api/corrections", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ correctionId, resolution }),
    });
    setMsg(`Correction #${correctionId}: ${resolution}`);
    setTimeout(() => location.reload(), 800);
  };

  return (
    <div className="space-y-8">
      {msg && <p className="text-xs font-mono text-[#00f2ff]">{msg}</p>}

      <section className="bg-[#0a0f14] p-8 rounded-2xl border border-[#1e3a4e]">
        <h2 className="text-sm font-bold uppercase tracking-widest text-[#00f2ff] mb-6">Pending Corrections</h2>
        <table className="w-full text-left">
          <thead className="text-[#00f2ff] uppercase text-xs tracking-widest font-bold">
            <tr className="border-b border-[#1e3a4e]"><th className="pb-4">#</th><th className="pb-4">Kind</th><th className="pb-4">Proposed</th><th className="pb-4">Scope</th></tr>
          </thead>
          <tbody className="text-sm font-mono">
            {corrections.filter((c) => c.status === "pending").length === 0 && (
              <tr><td colSpan={4} className="pt-6 text-[#1e3a4e]">NO PENDING CORRECTIONS</td></tr>
            )}
            {corrections.filter((c) => c.status === "pending").map((c) => (
              <tr key={c.id} className="border-b border-[#111820]">
                <td className="py-4">{c.id}</td>
                <td className="py-4 text-[#00f2ff]">{c.kind}</td>
                <td className="py-4 text-zinc-400 max-w-md truncate">{JSON.stringify(c.proposed)}</td>
                <td className="py-4 flex gap-3">
                  <button onClick={() => resolveCorrection(c.id, "used_once")} className="text-xs text-zinc-400 hover:text-[#00f2ff]">USE ONCE</button>
                  <button onClick={() => resolveCorrection(c.id, "approved_workbook")} className="text-xs text-zinc-400 hover:text-[#00f2ff]">THIS WORKBOOK</button>
                  <button onClick={() => resolveCorrection(c.id, "approved_global")} className="text-xs text-zinc-400 hover:text-[#00f2ff]">GLOBAL</button>
                  <button onClick={() => resolveCorrection(c.id, "rejected")} className="text-xs text-zinc-500 hover:text-red-400">REJECT</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="bg-[#0a0f14] p-8 rounded-2xl border border-[#1e3a4e]">
        <h2 className="text-sm font-bold uppercase tracking-widest text-[#00f2ff] mb-6">Rules & Version History</h2>
        <table className="w-full text-left">
          <thead className="text-[#00f2ff] uppercase text-xs tracking-widest font-bold">
            <tr className="border-b border-[#1e3a4e]"><th className="pb-4">Type</th><th className="pb-4">Name</th><th className="pb-4">Version</th><th className="pb-4">Status</th><th className="pb-4">Scope</th><th className="pb-4">Actions</th></tr>
          </thead>
          <tbody className="text-sm font-mono">
            {rules.length === 0 && <tr><td colSpan={6} className="pt-6 text-[#1e3a4e]">NO RULES — corrections and approved mappings appear here</td></tr>}
            {rules.map((r) => (
              <tr key={r.id} className="border-b border-[#111820]">
                <td className="py-4 text-[#00f2ff]">{r.type}</td>
                <td className="py-4 text-zinc-400">{r.name || "—"}</td>
                <td className="py-4 text-zinc-400">v{r.version}</td>
                <td className="py-4">
                  <span className={`text-[10px] uppercase px-2 py-1 rounded ${r.status === "active" ? "bg-[#0a1820] text-[#00f2ff]" : "bg-[#111820] text-zinc-500"}`}>{r.status}</span>
                </td>
                <td className="py-4 text-zinc-500 text-xs">{r.workbookId ? `wb #${r.workbookId}` : "global"}</td>
                <td className="py-4 flex gap-3">
                  {r.status === "active" && <button onClick={() => ruleAction(r.id, "disable")} className="text-xs text-zinc-400 hover:text-red-400">DISABLE</button>}
                  {r.status === "disabled" && <button onClick={() => ruleAction(r.id, "enable")} className="text-xs text-zinc-400 hover:text-[#00f2ff]">ENABLE</button>}
                  {r.supersedesId && <button onClick={() => ruleAction(r.id, "restore")} className="text-xs text-zinc-400 hover:text-[#00f2ff]">RESTORE PREV</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="bg-[#0a0f14] p-8 rounded-2xl border border-[#1e3a4e]">
        <h2 className="text-sm font-bold uppercase tracking-widest text-[#00f2ff] mb-6">Saved Workflows</h2>
        <ul className="space-y-3">
          {workflows.length === 0 && <li className="text-[#1e3a4e] text-sm font-mono">No workflows saved. Say "Shawn, remember this process" after a successful run.</li>}
          {workflows.map((w) => (
            <li key={w.id} className="flex justify-between items-center border-b border-[#111820] pb-3 text-sm font-mono">
              <span className="text-zinc-300">{w.name} <span className="text-[#1e3a4e]">v{w.version}</span></span>
              <span className={`text-[10px] uppercase ${w.isActive ? "text-[#00f2ff]" : "text-zinc-500"}`}>{w.isActive ? "active" : "inactive"}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
