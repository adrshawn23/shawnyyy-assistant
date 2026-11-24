import { db } from "@/db";
import { rules } from "@/db/schema";
import { eq } from "drizzle-orm";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const dynamic = 'force-dynamic';

export default async function RuleReview() {
  const allRules = await db.select().from(rules);

  async function toggleRule(id: number, isActive: boolean) {
    'use server';
    await db.update(rules).set({ isActive: !isActive }).where(eq(rules.id, id));
  }

  return (
    <div className="min-h-screen bg-[#050a0f] p-8 text-zinc-300">
      <div className="max-w-5xl mx-auto">
        <header className="mb-12 border-b border-[#1e3a4e] pb-6 flex items-center gap-4">
          <Link href="/" className="text-[#00f2ff] hover:text-white"><ArrowLeft /></Link>
          <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[#00f2ff] to-[#0066ff]">
            RULE HISTORY
          </h1>
        </header>

        <div className="bg-[#0a0f14] p-8 rounded-2xl border border-[#1e3a4e] shadow-[0_0_20px_rgba(0,150,255,0.05)]">
          <table className="w-full text-left">
            <thead className="text-[#00f2ff] uppercase text-xs tracking-widest font-bold">
              <tr className="border-b border-[#1e3a4e]">
                <th className="pb-4">Type</th>
                <th className="pb-4">Version</th>
                <th className="pb-4">Active</th>
                <th className="pb-4">Action</th>
              </tr>
            </thead>
            <tbody className="text-sm font-mono">
              {allRules.length === 0 && (
                <tr>
                  <td colSpan={4} className="pt-6 text-[#1e3a4e]">NO RULES DEFINED</td>
                </tr>
              )}
              {allRules.map((rule) => (
                <tr key={rule.id} className="border-b border-[#111820]">
                  <td className="py-4 text-[#00f2ff]">{rule.type}</td>
                  <td className="py-4 text-zinc-400">{rule.version}</td>
                  <td className="py-4 text-zinc-400">{rule.isActive ? "YES" : "NO"}</td>
                  <td className="py-4">
                    <form action={toggleRule.bind(null, rule.id, rule.isActive!)}>
                      <button type="submit" className="text-zinc-500 hover:text-[#00f2ff] underline">
                        TOGGLE
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}



