import { db } from "@/db";
import { accessRequests } from "@/db/schema";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const dynamic = 'force-dynamic';

export default async function AccessRequestCenter() {
  const requests = await db.select().from(accessRequests);

  return (
    <div className="min-h-screen bg-[#050a0f] p-8 text-zinc-300">
      <div className="max-w-5xl mx-auto">
        <header className="mb-12 border-b border-[#1e3a4e] pb-6 flex items-center gap-4">
          <Link href="/" className="text-[#00f2ff] hover:text-white"><ArrowLeft /></Link>
          <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[#00f2ff] to-[#0066ff]">
            ACCESS REQUEST CENTER
          </h1>
        </header>

        <div className="bg-[#0a0f14] p-8 rounded-2xl border border-[#1e3a4e] shadow-[0_0_20px_rgba(0,150,255,0.05)]">
          <table className="w-full text-left">
            <thead className="text-[#00f2ff] uppercase text-xs tracking-widest font-bold">
              <tr className="border-b border-[#1e3a4e]">
                <th className="pb-4">Workbook ID</th>
                <th className="pb-4">Status</th>
                <th className="pb-4">Reason</th>
              </tr>
            </thead>
            <tbody className="text-sm font-mono">
              {requests.length === 0 && (
                <tr>
                  <td colSpan={3} className="pt-6 text-[#1e3a4e]">NO ACTIVE REQUESTS</td>
                </tr>
              )}
              {requests.map((req) => (
                <tr key={req.id} className="border-b border-[#111820]">
                  <td className="py-4">{req.workbookId}</td>
                  <td className="py-4 text-[#00f2ff] uppercase">{req.status}</td>
                  <td className="py-4 text-zinc-400">{req.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}


