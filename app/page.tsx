import { db } from "@/db";
import { jobs } from "@/db/schema";
import { desc } from "drizzle-orm";
import Link from "next/link";
import CommandForm from "@/components/CommandForm";
import ChatInterface from "@/components/ChatInterface";

export const dynamic = 'force-dynamic';

export default async function Dashboard() {
  const jobList = await db.select().from(jobs).orderBy(desc(jobs.createdAt)).limit(10);

  return (
    <div className="min-h-screen bg-[#050a0f] p-8 text-zinc-300">
      <div className="max-w-6xl mx-auto">
        <header className="mb-12 border-b border-[#1e3a4e] pb-6 flex items-center justify-between">
          <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[#00f2ff] to-[#0066ff]">
            SHAWN COMMAND CENTRE
          </h1>
          <nav className="flex gap-8 text-sm font-bold tracking-widest uppercase text-[#1e3a4e]">
            <Link href="/access" className="hover:text-[#00f2ff] transition-colors">Access</Link>
            <Link href="/data-review" className="hover:text-[#00f2ff] transition-colors">Data</Link>
            <Link href="/rules" className="hover:text-[#00f2ff] transition-colors">Rules</Link>
          </nav>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            <section>
              <h2 className="text-sm font-bold uppercase tracking-widest text-[#00f2ff] mb-6">Interaction Hub</h2>
              <ChatInterface />
            </section>
          </div>

          <aside className="space-y-8">
            <section>
              <h2 className="text-sm font-bold uppercase tracking-widest text-[#00f2ff] mb-6">Execution Node</h2>
              <CommandForm />
            </section>

            <section>
              <h2 className="text-sm font-bold uppercase tracking-widest text-[#00f2ff] mb-6">System Log</h2>
              <div className="bg-[#0a0f14] p-6 rounded-2xl border border-[#1e3a4e] h-[200px] overflow-y-auto">
                <ul className="space-y-4">
                  {jobList.length === 0 && <li className="text-[#1e3a4e] text-xs font-mono">NO ACTIVE LOGS</li>}
                  {jobList.map((job) => (
                    <li key={job.id} className="flex justify-between items-center border-b border-[#111820] pb-3">
                      <span className="text-zinc-400 font-mono text-xs">{job.command.substring(0, 20)}...</span>
                      <span className="font-mono text-[10px] bg-[#111820] px-2 py-1 rounded text-[#00f2ff] uppercase">{job.status}</span>
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






