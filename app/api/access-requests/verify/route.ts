import { NextResponse } from "next/server";
import { verifyAccess, revokeAccess } from "@/services/access";
import { getSessionEmail } from "@/lib/auth";

export const dynamic = "force-dynamic";

// POST { workbookId } → re-verify actual access under Shawn's credentials
export async function POST(req: Request) {
  const email = await getSessionEmail();
  if (!email) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  try {
    const { workbookId, requestId, action } = await req.json();
    if (action === "revoke" && requestId) {
      await revokeAccess(requestId);
      return NextResponse.json({ ok: true, status: "revoked" });
    }
    if (!workbookId) return NextResponse.json({ error: "workbookId required" }, { status: 400 });
    const res = await verifyAccess(workbookId);
    return NextResponse.json(res);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed" }, { status: 500 });
  }
}
