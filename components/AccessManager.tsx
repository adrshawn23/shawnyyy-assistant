"use client";

import { useState } from "react";
import { Copy, Check, ShieldCheck, ShieldOff, Send } from "lucide-react";

interface Req {
  id: number;
  workbookId: number | null;
  workbookName: string;
  workbookUrl: string | null;
  ownerEmail: string | null;
  reason: string | null;
  role: string | null;
  status: string | null;
  draftText: string | null;
  verification: any;
  createdAt: string | null;
}

export default function AccessManager({ initial }: { initial: Req[] }) {
  const [requests, setRequests] = useState<Req[]>(initial);
  const [form, setForm] = useState({ workbookUrl: "", ownerEmail: "", reason: "", role: "viewer" });
  const [draft, setDraft] = useState<{ id: number; text: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [msg, setMsg] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg("");
    const res = await fetch("/api/access-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (data.request) {
      setDraft({ id: data.request.id, text: data.draftText });
      setMsg("Request created. Review the draft, then send it through the authorized company sender.");
      setRequests((r) => [{
        id: data.request.id, workbookId: data.workbook.id, workbookName: data.workbook.name || data.workbook.url,
        workbookUrl: data.workbook.url, ownerEmail: form.ownerEmail, reason: form.reason,
        role: form.role, status: "pending", draftText: data.draftText, verification: null, createdAt: new Date().toISOString(),
      }, ...r]);
    } else {
      setMsg(data.error || "Failed");
    }
  };

  const verify = async (workbookId: number) => {
    const res = await fetch("/api/access-requests/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workbookId }),
    });
    const data = await res.json();
    setMsg(`Verification: viewer=${data.viewer?.result}${data.editor ? `, editor=${data.editor.result}` : ""}${data.viewer?.detail ? ` — ${data.viewer.detail}` : ""}`);
    const list = await fetch("/api/access-requests").then((r) => r.json());
    setRequests(list.requests.map((r: any) => ({ ...r, workbookName: r.workbook?.name || r.workbook?.url || "—", workbookUrl: r.workbook?.url })));
  };

  const revoke = async (requestId: number) => {
    await fetch("/api/access-requests/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requestId, action: "revoke" }),
    });
    setRequests((r) => r.map((x) => x.id === requestId ? { ...x, status: "revoked" } : x));
  };

  const copyDraft = () => {
    if (draft) {
      navigator.clipboard.writeText(draft.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  return (
    <div className="space-y-8">
      <section className="bg-[#0a0f14] p-8 rounded-2xl border border-[#1e3a4e]">
        <h2 className="text-sm font-bold uppercase tracking-widest text-[#00f2ff] mb-6">New Access Request</h2>
        <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input placeholder="Sheet URL" value={form.workbookUrl} onChange={(e) => setForm({ ...form, workbookUrl: e.target.value })}
            className="bg-[#111820] border border-[#1e3a4e] p-3 rounded-xl text-[#00f2ff] font-mono text-sm focus:outline-none focus:border-[#00f2ff]" required />
          <input placeholder="Owner email" value={form.ownerEmail} onChange={(e) => setForm({ ...form, ownerEmail: e.target.value })}
            className="bg-[#111820] border border-[#1e3a4e] p-3 rounded-xl text-[#00f2ff] font-mono text-sm focus:outline-none focus:border-[#00f2ff]" required />
          <input placeholder="Reason" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })}
            className="bg-[#111820] border border-[#1e3a4e] p-3 rounded-xl text-[#00f2ff] font-mono text-sm focus:outline-none focus:border-[#00f2ff]" required />
          <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}
            className="bg-[#111820] border border-[#1e3a4e] p-3 rounded-xl text-[#00f2ff] font-mono text-sm focus:outline-none focus:border-[#00f2ff]">
            <option value="viewer">Viewer (source workbook)</option>
            <option value="editor">Editor (reporting workbook)</option>
          </select>
          <button type="submit" className="md:col-span-2 bg-[#00f2ff] text-[#0a0f14] font-bold py-3 rounded-xl hover:bg-white transition-all flex items-center justify-center gap-2">
            <Send className="w-4 h-4" /> DRAFT REQUEST
          </button>
        </form>
        {msg && <p className="mt-4 text-xs font-mono text-[#00f2ff]">{msg}</p>}
        {draft && (
          <div className="mt-6 bg-[#111820] border border-[#1e3a4e] rounded-xl p-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-bold text-[#00f2ff] uppercase">Draft — review before sending</span>
              <button onClick={copyDraft} className="text-xs font-mono text-zinc-400 hover:text-[#00f2ff] flex items-center gap-1">
                {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />} {copied ? "COPIED" : "COPY"}
              </button>
            </div>
            <pre className="text-xs font-mono text-zinc-300 whitespace-pre-wrap">{draft.text}</pre>
            <p className="mt-3 text-[10px] text-[#1e3a4e] font-mono">Send only through the authorized company sender after approval.</p>
          </div>
        )}
      </section>

      <section className="bg-[#0a0f14] p-8 rounded-2xl border border-[#1e3a4e]">
        <h2 className="text-sm font-bold uppercase tracking-widest text-[#00f2ff] mb-6">Requests</h2>
        <table className="w-full text-left">
          <thead className="text-[#00f2ff] uppercase text-xs tracking-widest font-bold">
            <tr className="border-b border-[#1e3a4e]">
              <th className="pb-4">Workbook</th><th className="pb-4">Role</th><th className="pb-4">Status</th><th className="pb-4">Actions</th>
            </tr>
          </thead>
          <tbody className="text-sm font-mono">
            {requests.length === 0 && <tr><td colSpan={4} className="pt-6 text-[#1e3a4e]">NO REQUESTS</td></tr>}
            {requests.map((r) => (
              <tr key={r.id} className="border-b border-[#111820]">
                <td className="py-4">
                  <div className="text-zinc-300">{r.workbookName}</div>
                  <div className="text-[10px] text-[#1e3a4e]">{r.reason}</div>
                </td>
                <td className="py-4 text-zinc-400 uppercase">{r.role}</td>
                <td className="py-4">
                  <span className={`uppercase text-[10px] px-2 py-1 rounded ${
                    r.status === "verified" ? "bg-[#0a1820] text-[#00f2ff]" :
                    r.status === "revoked" ? "bg-red-950 text-red-400" : "bg-[#111820] text-zinc-400"
                  }`}>{r.status}</span>
                </td>
                <td className="py-4 flex gap-3">
                  {r.workbookId && r.status !== "revoked" && (
                    <button onClick={() => verify(r.workbookId!)} className="text-[#00f2ff] hover:text-white flex items-center gap-1 text-xs">
                      <ShieldCheck className="w-3 h-3" /> VERIFY
                    </button>
                  )}
                  {r.status !== "revoked" && (
                    <button onClick={() => revoke(r.id)} className="text-zinc-500 hover:text-red-400 flex items-center gap-1 text-xs">
                      <ShieldOff className="w-3 h-3" /> REVOKE
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
