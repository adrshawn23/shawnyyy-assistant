import { db } from "@/db";
import { accessRequests, workbooks, verifications } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getSessionEmail } from "@/lib/auth";
import { redirect } from "next/navigation";
import AccessManager from "@/components/AccessManager";

export const dynamic = "force-dynamic";

export default async function AccessRequestCenter() {
  const email = await getSessionEmail();
  if (!email) redirect("/login");

  const rows = await db
    .select({ request: accessRequests, workbook: workbooks })
    .from(accessRequests)
    .leftJoin(workbooks, eq(accessRequests.workbookId, workbooks.id))
    .orderBy(desc(accessRequests.createdAt));

  const data = rows.map((r) => ({
    id: r.request.id,
    workbookId: r.request.workbookId,
    workbookName: r.workbook?.name || r.workbook?.url || "—",
    workbookUrl: r.workbook?.url ?? null,
    ownerEmail: r.request.ownerEmail,
    reason: r.request.reason,
    role: r.request.requestedRole,
    status: r.request.status,
    draftText: r.request.draftText,
    verification: r.request.verification,
    createdAt: r.request.createdAt?.toISOString() ?? null,
  }));

  return (
    <div className="min-h-screen bg-[#050a0f] p-8 text-zinc-300">
      <div className="max-w-6xl mx-auto">
        <header className="mb-12 border-b border-[#1e3a4e] pb-6 flex items-center gap-4">
          <Link href="/" className="text-[#00f2ff] hover:text-white"><ArrowLeft /></Link>
          <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[#00f2ff] to-[#0066ff]">
            ACCESS REQUESTS
          </h1>
        </header>
        <AccessManager initial={data} />
      </div>
    </div>
  );
}
