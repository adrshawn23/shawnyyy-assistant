import { db } from "@/db";
import { jobs } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getSessionEmail } from "@/lib/auth";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const email = await getSessionEmail();
  if (!email) redirect("/login");

  const completed = await db.select().from(jobs)
    .where(eq(jobs.status, "completed"))
    .orderBy(desc(jobs.createdAt)).limit(5);
  const latest = completed[0];
  const kpi = (latest?.result as any)?.kpi;

  return (
    <div className="min-h-screen bg-[#050a0f] p-8 text-zinc-300">
      <div className="max-w-6xl mx-auto">
        <header className="mb-12 border-b border-[#1e3a4e] pb-6 flex items-center gap-4">
          <Link href="/" className="text-[#00f2ff] hover:text-white"><ArrowLeft /></Link>
          <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[#00f2ff] to-[#0066ff]">
            DASHBOARD
          </h1>
        </header>

        {!latest && (
          <div className="bg-[#0a0f14] p-8 rounded-2xl border border-[#1e3a4e] text-[#1e3a4e] font-mono text-sm">
            No completed reports yet. Run "clean this raw data and build this week's hub report" from the Command Center.
          </div>
        )}

        {latest && kpi && (
          <div className="space-y-8">
            <section className="bg-[#0a0f14] p-8 rounded-2xl border border-[#1e3a4e]">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-lg font-bold text-[#00f2ff]">Hub Report — Job #{latest.id}</h2>
                  <p className="text-xs font-mono text-zinc-500 mt-1">
                    Period {kpi.period?.start} → {kpi.period?.end} · Source: {(latest.result as any)?.sourceTab} · Generated {new Date((latest.result as any)?.freshness).toLocaleString()}
                  </p>
                </div>
                <Link href={`/data-review?job=${latest.id}`} className="text-xs font-mono text-[#00f2ff] hover:text-white">DETAIL →</Link>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Stat label="Events" value={kpi.totals.events} />
                <Stat label="Distinct Shipments" value={kpi.totals.shipments} />
                <Stat label="Hubs" value={kpi.totals.hubComparison.length} />
                <Stat label="Statuses" value={Object.keys(kpi.totals.statusBreakdown).length} />
              </div>
            </section>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <section className="bg-[#0a0f14] p-8 rounded-2xl border border-[#1e3a4e]">
                <h3 className="text-sm font-bold uppercase tracking-widest text-[#00f2ff] mb-4">Daily Trend</h3>
                <ul className="space-y-2">
                  {kpi.totals.dailyTrend.map((d: any) => (
                    <li key={d.date} className="flex justify-between text-xs font-mono">
                      <span className="text-zinc-400">{d.date}</span>
                      <span className="text-[#00f2ff]">{d.events} events</span>
                    </li>
                  ))}
                </ul>
              </section>
              <section className="bg-[#0a0f14] p-8 rounded-2xl border border-[#1e3a4e]">
                <h3 className="text-sm font-bold uppercase tracking-widest text-[#00f2ff] mb-4">Hub Comparison</h3>
                <ul className="space-y-2">
                  {kpi.totals.hubComparison.map((h: any) => (
                    <li key={h.hub} className="flex justify-between text-xs font-mono">
                      <span className="text-zinc-400">{h.hub}</span>
                      <span className="text-[#00f2ff]">{h.events} events · {h.shipments} shipments</span>
                    </li>
                  ))}
                </ul>
              </section>
            </div>

            <section className="bg-[#0a0f14] p-8 rounded-2xl border border-[#1e3a4e]">
              <h3 className="text-sm font-bold uppercase tracking-widest text-[#00f2ff] mb-4">Status Breakdown</h3>
              <div className="flex flex-wrap gap-3">
                {Object.entries(kpi.totals.statusBreakdown).map(([s, n]: any) => (
                  <span key={s} className="text-xs font-mono bg-[#111820] border border-[#1e3a4e] rounded-lg px-3 py-2">
                    <span className="text-zinc-400">{s}:</span> <span className="text-[#00f2ff]">{n}</span>
                  </span>
                ))}
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: any }) {
  return (
    <div className="bg-[#111820] border border-[#1e3a4e] rounded-xl p-4">
      <div className="text-[10px] uppercase tracking-widest text-[#1e3a4e]">{label}</div>
      <div className="text-2xl font-black text-[#00f2ff] mt-1">{value}</div>
    </div>
  );
}
