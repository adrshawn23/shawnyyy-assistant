"use client";

export default function JobDetail({ job }: { job: any }) {
  const result = job.result as any;
  const recon = job.reconciliation as any;
  const kpi = result?.kpi;

  return (
    <div className="space-y-6">
      <section className="bg-[#0a0f14] p-6 rounded-2xl border border-[#1e3a4e]">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-lg font-bold text-[#00f2ff]">Job #{job.id} — {job.type}</h2>
            <p className="text-xs font-mono text-zinc-500 mt-1">{job.command}</p>
          </div>
          <span className={`text-[10px] font-mono px-3 py-1 rounded uppercase ${
            job.status === "completed" ? "bg-[#0a1820] text-[#00f2ff]" :
            job.status === "failed" ? "bg-red-950 text-red-400" : "bg-[#111820] text-zinc-400"
          }`}>{job.status}</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 text-xs font-mono">
          <div><span className="text-[#1e3a4e]">PERIOD</span><div className="text-zinc-300">{job.periodStart} → {job.periodEnd}</div></div>
          <div><span className="text-[#1e3a4e]">SOURCE TAB</span><div className="text-zinc-300">{result?.sourceTab || "—"}</div></div>
          <div><span className="text-[#1e3a4e]">FRESHNESS</span><div className="text-zinc-300">{result?.freshness ? new Date(result.freshness).toLocaleString() : "—"}</div></div>
          <div><span className="text-[#1e3a4e]">MAPPING</span><div className="text-zinc-300">{result?.mappingSource || "—"}</div></div>
        </div>
        {job.error && <p className="mt-4 text-xs font-mono text-red-400">{job.error}</p>}
      </section>

      {recon && (
        <section className="bg-[#0a0f14] p-6 rounded-2xl border border-[#1e3a4e]">
          <h3 className="text-sm font-bold uppercase tracking-widest text-[#00f2ff] mb-4">Reconciliation</h3>
          <div className={`text-sm font-mono mb-3 ${recon.ok ? "text-[#00f2ff]" : "text-red-400"}`}>
            {recon.ok ? "PASS" : "FAIL"} — source={recon.sourceRows}, clean={recon.cleanRows}, flagged={recon.flaggedRows}, filtered events={recon.filteredEvents}
          </div>
          <ul className="text-xs font-mono space-y-1">
            {recon.checks?.map((c: any) => (
              <li key={c.name} className={c.ok ? "text-zinc-400" : "text-red-400"}>
                {c.ok ? "✓" : "✗"} {c.name}: {c.detail}
              </li>
            ))}
          </ul>
          {recon.failures?.length > 0 && (
            <p className="mt-3 text-xs font-mono text-red-400">Paused before publishing: {recon.failures.join(" ")}</p>
          )}
        </section>
      )}

      {kpi && (
        <section className="bg-[#0a0f14] p-6 rounded-2xl border border-[#1e3a4e]">
          <h3 className="text-sm font-bold uppercase tracking-widest text-[#00f2ff] mb-4">KPIs — {kpi.period?.start} to {kpi.period?.end}</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KpiCard label="Events" value={kpi.totals.events} sub="counts events" />
            <KpiCard label="Shipments" value={kpi.totals.shipments} sub="distinct Tracking IDs" />
            <KpiCard label="Flagged" value={result?.stats?.flaggedRows ?? "—"} sub="excluded from totals" />
            <KpiCard label="Repeated events" value={result?.stats?.repeatedEvents ?? "—"} sub="shipments w/ multiple events" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
            <Breakdown title="Status" data={Object.entries(kpi.totals.statusBreakdown).map(([k, v]) => [k, v])} />
            <Breakdown title="Daily trend" data={kpi.totals.dailyTrend.map((d: any) => [d.date, d.events])} />
            <Breakdown title="Hub comparison" data={kpi.totals.hubComparison.map((h: any) => [h.hub, `${h.events} ev / ${h.shipments} sh`])} />
          </div>
          <p className="mt-4 text-[10px] font-mono text-[#1e3a4e]">
            KPI definitions: events count clean rows; shipments count unique Tracking IDs; flagged rows are excluded. Date field: Event Date.
          </p>
        </section>
      )}

      {result?.exceptions?.length > 0 && (
        <section className="bg-[#0a0f14] p-6 rounded-2xl border border-[#1e3a4e]">
          <h3 className="text-sm font-bold uppercase tracking-widest text-[#00f2ff] mb-4">Exceptions ({result.exceptions.length})</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="text-[#00f2ff] uppercase">
                <tr className="border-b border-[#1e3a4e]"><th className="pb-2">Row</th><th className="pb-2">ID</th><th className="pb-2">Hub</th><th className="pb-2">Status</th><th className="pb-2">Date</th><th className="pb-2">Flags</th></tr>
              </thead>
              <tbody>
                {result.exceptions.map((e: any, i: number) => (
                  <tr key={i} className="border-b border-[#111820]">
                    <td className="py-2">{e.row}</td><td className="py-2">{e.id}</td><td className="py-2">{e.hub}</td>
                    <td className="py-2">{e.status}</td><td className="py-2">{e.date}</td>
                    <td className="py-2 text-red-400">{e.flags?.join(", ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {result?.write && (
        <section className="bg-[#0a0f14] p-6 rounded-2xl border border-[#1e3a4e]">
          <h3 className="text-sm font-bold uppercase tracking-widest text-[#00f2ff] mb-2">Publish</h3>
          <p className="text-xs font-mono text-zinc-400">
            {result.write.skipped ? `Skipped: ${result.write.skipped}` : `Wrote to ${result.write.workbook} → ${result.write.tabs?.join(", ")}`}
          </p>
        </section>
      )}
    </div>
  );
}

function KpiCard({ label, value, sub }: { label: string; value: any; sub: string }) {
  return (
    <div className="bg-[#111820] border border-[#1e3a4e] rounded-xl p-4">
      <div className="text-[10px] uppercase tracking-widest text-[#1e3a4e]">{label}</div>
      <div className="text-2xl font-black text-[#00f2ff] mt-1">{value}</div>
      <div className="text-[10px] font-mono text-zinc-500 mt-1">{sub}</div>
    </div>
  );
}

function Breakdown({ title, data }: { title: string; data: any[] }) {
  return (
    <div>
      <h4 className="text-xs font-bold uppercase tracking-widest text-[#00f2ff] mb-2">{title}</h4>
      <ul className="text-xs font-mono space-y-1 max-h-40 overflow-y-auto">
        {data.length === 0 && <li className="text-[#1e3a4e]">—</li>}
        {data.map((d, i) => <li key={i} className="flex justify-between text-zinc-400"><span>{d[0]}</span><span className="text-[#00f2ff]">{d[1]}</span></li>)}
      </ul>
    </div>
  );
}
