"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Send, Bot, User } from "lucide-react";

export default function ChatInterface() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant', content: string }[]>([]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage = { role: 'user' as const, content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput("");

    const res = await fetch("/api/commands", {
      method: "POST",
      body: JSON.stringify({ command: input, workbookUrl: "" }),
    });
    const data = await res.json();
    
    setMessages(prev => [...prev, { role: 'assistant', content: `ACTION: ${data.intent} (Confidence: ${data.confidence})` }]);
  };

  return (
    <div className="bg-[#0a0f14] p-6 rounded-2xl border border-[#1e3a4e] shadow-[0_0_20px_rgba(0,150,255,0.1)] h-[500px] flex flex-col">
      <h3 className="text-sm font-bold tracking-widest text-[#00f2ff] uppercase mb-4">Shawn Terminal</h3>
      
      <div className="flex-1 overflow-y-auto mb-4 space-y-4">
        {messages.map((m, i) => (
          <div key={i} className={`flex items-start gap-3 ${m.role === 'user' ? 'justify-end' : ''}`}>
            {m.role === 'assistant' && <Bot className="w-6 h-6 text-[#00f2ff]" />}
            <div className={`p-3 rounded-lg max-w-[80%] text-sm font-mono ${m.role === 'user' ? 'bg-[#1e3a4e] text-white' : 'bg-[#111820] text-[#00f2ff]'}`}>
              {m.content}
            </div>
            {m.role === 'user' && <User className="w-6 h-6 text-zinc-500" />}
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="SEND COMMAND..."
          className="flex-1 bg-[#111820] border border-[#1e3a4e] p-3 rounded-xl text-[#00f2ff] font-mono focus:outline-none"
        />
        <button onClick={handleSend} className="bg-[#00f2ff] text-[#0a0f14] p-3 rounded-xl hover:bg-white transition-all">
          <Send className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
