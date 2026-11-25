import { db } from "@/db";
import { jobs } from "@/db/schema";
import { desc } from "drizzle-orm";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getSessionEmail } from "@/lib/auth";
import { redirect } from "next/navigation";
import JobDetail from "@/components/JobDetail";

export const dynamic = "force-dynamic";

export default async function DataReview({ searchParams }: { searchParams: Promise<{ job?: string }> }) {
  const email = await getSessionEmail();
  if (!email) redirect("/login");

  const { job: jobId } = await searchParams;
  const jobList = await db.select().from(jobs).orderBy(desc(jobs.createdAt)).limit(30);
  const selected = jobId ? jobList.find((j) => j.id === parseInt(jobId)) : jobList[0];

  return (
    <div className="min-h-screen bg-[#050a0f] p-8 text-zinc-300">
      <div className="max-w-6xl mx-auto">
        <header className="mb-12 border-b border-[#1e3a4e] pb-6 flex items-center gap-4">
          <Link href="/" className="text-[#00f2ff] hover:text-white"><ArrowLeft /></Link>
          <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[#00f2ff] to-[#0066ff]">
            DATA REVIEW
          </h1>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          <aside className="bg-[#0a0f14] p-4 rounded-2xl border border-[#1e3a4e] h-fit">
            <h2 className="text-xs font-bold uppercase tracking-widest text-[#00f2ff] mb-4">Jobs</h2>
            <ul className="space-y-2">
              {jobList.map((j) => (
                <li key={j.id}>
                  <Link href={`/data-review?job=${j.id}`}
                    className={`block text-xs font-mono px-3 py-2 rounded-lg ${selected?.id === j.id ? "bg-[#1e3a4e] text-[#00f2ff]" : "text-zinc-400 hover:text-[#00f2ff]"}`}>
                    #{j.id} {j.type} <span className="text-[#1e3a4e]">{j.status}</span>
                  </Link>
                </li>
              ))}
              {jobList.length === 0 && <li className="text-[#1e3a4e] text-xs font-mono">NO JOBS</li>}
            </ul>
          </aside>
          <div className="lg:col-span-3">
            {selected ? <JobDetail job={selected} /> : (
              <div className="bg-[#0a0f14] p-8 rounded-2xl border border-[#1e3a4e] text-[#1e3a4e] font-mono text-sm">
                Run a command from the Command Center to see results here.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
