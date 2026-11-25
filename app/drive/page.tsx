"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { FileSpreadsheet, FileText, File, Search, RefreshCw, Unplug, Loader2 } from "lucide-react";

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
  webViewLink?: string;
}

interface Analysis {
  summary: string;
  details: Record<string, any>;
  kind: string;
}

const MIME_LABELS: Record<string, string> = {
  "application/vnd.google-apps.spreadsheet": "Sheets",
  "application/vnd.google-apps.document": "Docs",
  "application/vnd.google-apps.folder": "Folder",
};

function DrivePageInner() {
  const params = useSearchParams();
  const [status, setStatus] = useState<{ oauthConfigured: boolean; connected: boolean; email: string | null } | null>(null);
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [query, setQuery] = useState("");
  const [mime, setMime] = useState("");
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<{ file: DriveFile; data: Analysis } | null>(null);
  const [notice, setNotice] = useState("");

  const loadStatus = async () => {
    const res = await fetch("/api/drive?status=1");
    const data = await res.json();
    setStatus(data);
    return data;
  };

  const loadFiles = async (q = query, m = mime) => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (q) qs.set("query", q);
      if (m) qs.set("mime", m);
      const res = await fetch(`/api/drive?${qs}`);
      const data = await res.json();
      if (data.error) setNotice(data.error);
      else setFiles(data.files || []);
    } catch (e: any) {
      setNotice(e?.message || "Failed to load files");
    }
    setLoading(false);
  };

  useEffect(() => {
    (async () => {
      const s = await loadStatus();
      if (s?.connected) loadFiles();
      const connected = params.get("connected");
      const error = params.get("error");
      if (connected) setNotice(`Connected as ${connected}`);
      if (error) setNotice(`Google connection failed: ${error}`);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const analyze = async (f: DriveFile) => {
    setAnalyzing(f.id);
    setAnalysis(null);
    try {
      const res = await fetch("/api/drive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileId: f.id }),
      });
      const data = await res.json();
      if (data.error) setNotice(data.error);
      else setAnalysis({ file: f, data });
    } catch (e: any) {
      setNotice(e?.message || "Analysis failed");
    }
    setAnalyzing(null);
  };

  const disconnect = async () => {
    await fetch("/api/auth/google", { method: "DELETE" });
    setStatus((s) => (s ? { ...s, connected: false, email: null } : s));
    setFiles([]);
    setNotice("Disconnected from Google.");
  };

  const icon = (mimeType: string) =>
    mimeType.includes("spreadsheet") ? <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
    : mimeType.includes("document") ? <FileText className="w-5 h-5 text-blue-400" />
    : <File className="w-5 h-5 text-zinc-500" />;

  return (
    <div className="min-h-screen bg-[#050a0f] text-[#00f2ff] p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[#00f2ff] to-[#0066ff]">GOOGLE DRIVE</h1>
            <p className="text-xs text-[#1e3a4e] font-mono mt-1">BROWSE & ANALYZE YOUR FILES</p>
          </div>
          {status?.connected && (
            <button onClick={disconnect} className="flex items-center gap-2 text-xs font-mono text-red-400 border border-red-900/50 px-3 py-2 rounded-lg hover:bg-red-950/30">
              <Unplug className="w-4 h-4" /> DISCONNECT {status.email}
            </button>
          )}
        </div>

        {notice && <div className="bg-[#0a0f14] border border-[#1e3a4e] rounded-xl p-3 text-xs font-mono text-[#00f2ff]">{notice}</div>}

        {status && !status.oauthConfigured && (
          <div className="bg-[#0a0f14] border border-yellow-900/50 rounded-xl p-4 text-sm font-mono text-yellow-300">
            Google OAuth is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env, then restart.
          </div>
        )}

        {status?.oauthConfigured && !status.connected && (
          <div className="bg-[#0a0f14] border border-[#1e3a4e] rounded-2xl p-8 text-center space-y-4">
            <p className="text-sm font-mono text-zinc-400">Connect your Google account so Shawn can read and analyze your Drive files.</p>
            <a href="/api/auth/google" className="inline-block bg-[#00f2ff] text-[#0a0f14] font-bold px-6 py-3 rounded-xl hover:bg-white transition-all">
              CONNECT GOOGLE ACCOUNT
            </a>
          </div>
        )}

        {status?.connected && (
          <>
            <div className="flex gap-2">
              <div className="flex-1 flex items-center gap-2 bg-[#0a0f14] border border-[#1e3a4e] rounded-xl px-3">
                <Search className="w-4 h-4 text-[#1e3a4e]" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && loadFiles()}
                  placeholder="Search your Drive..."
                  className="flex-1 bg-transparent py-3 text-sm font-mono focus:outline-none"
                />
              </div>
              <select
                value={mime}
                onChange={(e) => { setMime(e.target.value); loadFiles(query, e.target.value); }}
                className="bg-[#0a0f14] border border-[#1e3a4e] rounded-xl px-3 text-sm font-mono"
              >
                <option value="">All files</option>
                <option value="application/vnd.google-apps.spreadsheet">Google Sheets</option>
                <option value="application/vnd.google-apps.document">Google Docs</option>
                <option value="application/vnd.google-apps.folder">Folders</option>
              </select>
              <button onClick={() => loadFiles()} className="bg-[#111820] border border-[#1e3a4e] p-3 rounded-xl hover:border-[#00f2ff]">
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              </button>
            </div>

            <div className="bg-[#0a0f14] border border-[#1e3a4e] rounded-2xl overflow-hidden">
              {files.length === 0 && !loading && (
                <p className="p-6 text-sm font-mono text-zinc-500">No files found.</p>
              )}
              {files.map((f) => (
                <div key={f.id} className="flex items-center gap-3 px-4 py-3 border-b border-[#111820] last:border-0 hover:bg-[#111820]">
                  {icon(f.mimeType)}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-mono truncate">{f.name}</p>
                    <p className="text-[10px] text-[#1e3a4e] font-mono">
                      {MIME_LABELS[f.mimeType] || f.mimeType.split(".").pop()} · {f.modifiedTime?.slice(0, 10)}
                    </p>
                  </div>
                  <button
                    onClick={() => analyze(f)}
                    disabled={analyzing === f.id}
                    className="text-xs font-mono bg-[#1e3a4e] text-[#00f2ff] px-3 py-1.5 rounded-lg hover:bg-[#00f2ff] hover:text-[#0a0f14] transition-all disabled:opacity-50"
                  >
                    {analyzing === f.id ? <Loader2 className="w-3 h-3 animate-spin" /> : "ANALYZE"}
                  </button>
                  {f.webViewLink && (
                    <a href={f.webViewLink} target="_blank" rel="noreferrer" className="text-xs font-mono text-[#1e3a4e] hover:text-[#00f2ff]">OPEN</a>
                  )}
                </div>
              ))}
            </div>

            {analysis && (
              <div className="bg-[#0a0f14] border border-[#00f2ff]/30 rounded-2xl p-6 space-y-3">
                <h2 className="text-sm font-bold tracking-widest uppercase">Analysis: {analysis.file.name}</h2>
                <p className="text-sm font-mono text-zinc-300 whitespace-pre-wrap">{analysis.data.summary}</p>
                {analysis.data.details.headers?.length > 0 && (
                  <div>
                    <p className="text-xs font-mono text-[#1e3a4e] mb-1">COLUMNS</p>
                    <div className="flex flex-wrap gap-1">
                      {analysis.data.details.headers.map((h: string, i: number) => (
                        <span key={i} className="text-[10px] font-mono bg-[#111820] border border-[#1e3a4e] px-2 py-1 rounded">
                          {h} <span className="text-[#1e3a4e]">({analysis.data.details.columnFillRate?.[i] ?? 0}%)</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function DrivePage() {
  return (
    <Suspense fallback={<div className='min-h-screen bg-[#050a0f] p-8 text-[#00f2ff] font-mono'>LOADING...</div>}>
      <DrivePageInner />
    </Suspense>
  );
}
