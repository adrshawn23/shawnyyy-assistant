"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Terminal, Send, Database } from "lucide-react";

export default function CommandForm() {
  const [url, setUrl] = useState("");
  const [status, setStatus] = useState("");

  const handleClean = async () => {
    setStatus("INITIALIZING DATA CLEANING SEQUENCE...");
    const res = await fetch("/api/commands", {
      method: "POST",
      body: JSON.stringify({ command: "clean this data", workbookUrl: url }),
    });
    const data = await res.json();
    setStatus(`JOB INITIALIZED. ID: ${data.jobId}`);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-[#0a0f14] p-6 rounded-2xl border border-[#1e3a4e] shadow-[0_0_20px_rgba(0,150,255,0.1)]"
    >
      <div className="flex items-center gap-2 mb-6">
        <Database className="w-5 h-5 text-[#00f2ff]" />
        <h3 className="text-sm font-bold tracking-widest text-[#00f2ff] uppercase">Data Pipeline Access</h3>
      </div>
      
      <div className="flex flex-col gap-4">
        <input
          type="text"
          placeholder="ENTER GOOGLE SHEET URL"
          className="w-full bg-[#111820] border border-[#1e3a4e] p-4 rounded-xl text-[#00f2ff] placeholder-[#1e3a4e] focus:border-[#00f2ff] focus:ring-1 focus:ring-[#00f2ff] focus:outline-none transition-all font-mono"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        <button 
          onClick={handleClean}
          className="w-full bg-transparent border border-[#00f2ff] text-[#00f2ff] font-bold py-4 px-6 rounded-xl hover:bg-[#00f2ff] hover:text-[#0a0f14] transition-all flex items-center justify-center gap-2 tracking-wider"
        >
          <Terminal className="w-5 h-5" />
          EXECUTE CLEANING
        </button>
      </div>
      
      {status && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-6 p-4 bg-[#0a1820] text-[#00f2ff] rounded-xl text-xs font-mono border border-[#1e3a4e]"
        >
          {`> ${status}`}
        </motion.div>
      )}
    </motion.div>
  );
}


