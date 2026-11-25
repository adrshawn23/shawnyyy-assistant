import { db } from "@/db";
import { jobs } from "@/db/schema";
import { desc } from "drizzle-orm";
import Link from "next/link";
import ChatInterface from "@/components/ChatInterface";
import QuickCommands from "@/components/QuickCommands";
import { getSessionEmail } from "@/lib/auth";
import { redirect } from "next/navigation";
import { isDemo } from "@/lib/env";

export const dynamic = "force-dynamic";

export default async function CommandCenter() {
  const email = await getSessionEmail();
  if (!email) redirect("/login");

  const jobList = await db.select().from(jobs).orderBy(desc(jobs.createdAt)).limit(10);

  return (
    <div className="min-h-screen bg-[#050a0f] p-8 text-zinc-300">
      <div className="max-w-6xl mx-auto">
        <header className="mb-12 border-b border-[#1e3a4e] pb-6 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[#00f2ff] to-[#0066ff]">
              SHAWN
            </h1>
            <p className="text-xs text-[#1e3a4e] font-mono mt-1">
              AI WORK ASSISTANT {isDemo() && "— DEMO MODE (no Google credentials)"} — signed in as {email}
            </p>
          </div>
          <nav className="flex gap-8 text-sm font-bold tracking-widest uppercase text-[#1e3a4e]">
            <Link href="/drive" className="hover:text-[#00f2ff] transition-colors">Drive</Link>
            <Link href="/access" className="hover:text-[#00f2ff] transition-colors">Access</Link>
            <Link href="/data-review" className="hover:text-[#00f2ff] transition-colors">Data Review</Link>
            <Link href="/dashboard" className="hover:text-[#00f2ff] transition-colors">Dashboard</Link>
            <Link href="/rules" className="hover:text-[#00f2ff] transition-colors">Rules</Link>
          </nav>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            <ChatInterface />
          </div>
          <aside className="space-y-8">
            <QuickCommands />
            <section>
              <h2 className="text-sm font-bold uppercase tracking-widest text-[#00f2ff] mb-6">Job Log</h2>
              <div className="bg-[#0a0f14] p-6 rounded-2xl border border-[#1e3a4e] max-h-[300px] overflow-y-auto">
                <ul className="space-y-4">
                  {jobList.length === 0 && <li className="text-[#1e3a4e] text-xs font-mono">NO ACTIVE LOGS</li>}
                  {jobList.map((job) => (
                    <li key={job.id} className="flex justify-between items-center border-b border-[#111820] pb-3">
                      <Link href={`/data-review?job=${job.id}`} className="text-zinc-400 font-mono text-xs hover:text-[#00f2ff]">
                        #{job.id} {job.type} — {job.command.substring(0, 24)}
                      </Link>
                      <span className={`font-mono text-[10px] px-2 py-1 rounded uppercase ${
                        job.status === "completed" ? "bg-[#0a1820] text-[#00f2ff]" :
                        job.status === "failed" ? "bg-red-950 text-red-400" :
                        "bg-[#111820] text-zinc-400"
                      }`}>{job.status}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}
