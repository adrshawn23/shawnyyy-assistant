import { NextResponse } from "next/server";
import { db } from "@/db";
import { accessRequests, workbooks } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { createAccessRequest } from "@/services/access";
import { serviceAccountEmail } from "@/lib/google";
import { getSessionEmail } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const email = await getSessionEmail();
  if (!email) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const rows = await db
    .select({ request: accessRequests, workbook: workbooks })
    .from(accessRequests)
    .leftJoin(workbooks, eq(accessRequests.workbookId, workbooks.id))
    .orderBy(desc(accessRequests.createdAt));
  return NextResponse.json({
    serviceAccountEmail: serviceAccountEmail(),
    requests: rows.map((r) => ({ ...r.request, workbook: r.workbook })),
  });
}

export async function POST(req: Request) {
  const email = await getSessionEmail();
  if (!email) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  try {
    const { workbookUrl, ownerEmail, reason, role } = await req.json();
    if (!workbookUrl || !ownerEmail || !reason) {
      return NextResponse.json({ error: "workbookUrl, ownerEmail and reason are required" }, { status: 400 });
    }
    const res = await createAccessRequest({
      workbookUrl, ownerEmail, reason,
      role: role === "editor" ? "editor" : "viewer",
      requesterEmail: email,
    });
    return NextResponse.json(res);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed" }, { status: 500 });
  }
}
