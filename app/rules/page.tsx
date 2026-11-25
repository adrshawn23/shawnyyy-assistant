import { db } from "@/db";
import { rules, corrections, workflows } from "@/db/schema";
import { desc } from "drizzle-orm";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getSessionEmail } from "@/lib/auth";
import { redirect } from "next/navigation";
import RulesManager from "@/components/RulesManager";

export const dynamic = "force-dynamic";

export default async function RuleReview() {
  const email = await getSessionEmail();
  if (!email) redirect("/login");

  const allRules = await db.select().from(rules).orderBy(desc(rules.createdAt));
  const allCorrections = await db.select().from(corrections).orderBy(desc(corrections.createdAt));
  const allWorkflows = await db.select().from(workflows).orderBy(desc(workflows.createdAt));

  return (
    <div className="min-h-screen bg-[#050a0f] p-8 text-zinc-300">
      <div className="max-w-6xl mx-auto">
        <header className="mb-12 border-b border-[#1e3a4e] pb-6 flex items-center gap-4">
          <Link href="/" className="text-[#00f2ff] hover:text-white"><ArrowLeft /></Link>
          <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[#00f2ff] to-[#0066ff]">
            RULES & LEARNING
          </h1>
        </header>
        <RulesManager
          rules={allRules.map((r) => ({ ...r, createdAt: r.createdAt?.toISOString() ?? null, updatedAt: r.updatedAt?.toISOString() ?? null }))}
          corrections={allCorrections.map((c) => ({ ...c, createdAt: c.createdAt?.toISOString() ?? null }))}
          workflows={allWorkflows.map((w) => ({ ...w, createdAt: w.createdAt?.toISOString() ?? null }))}
        />
      </div>
    </div>
  );
}
