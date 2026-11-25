import { NextResponse } from "next/server";
import { listCorrections, resolveCorrection } from "@/services/learning";
import { approveRule } from "@/services/learning";
import { getSessionEmail } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const email = await getSessionEmail();
  if (!email) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") || undefined;
  const corrections = await listCorrections(status);
  return NextResponse.json({ corrections });
}

// POST { correctionId, resolution, scopeWorkbookIds? }
// resolution: used_once | approved_workbook | approved_global | rejected
export async function POST(req: Request) {
  const email = await getSessionEmail();
  if (!email) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const { correctionId, resolution, scopeWorkbookIds } = await req.json();
  if (!correctionId || !resolution) {
    return NextResponse.json({ error: "correctionId and resolution required" }, { status: 400 });
  }
  await resolveCorrection(correctionId, resolution);

  // When approved, materialize a rule so future runs apply it automatically.
  if (resolution === "approved_workbook" || resolution === "approved_global") {
    const { corrections } = await import("@/db/schema");
    const { eq } = await import("drizzle-orm");
    const { db } = await import("@/db");
    const corr = (await db.select().from(corrections).where(eq(corrections.id, correctionId)).limit(1))[0];
    if (corr) {
      await approveRule({
        workbookId: resolution === "approved_workbook" ? corr.workbookId : null,
        scopeWorkbookIds: resolution === "approved_global" ? scopeWorkbookIds || null : null,
        type: corr.kind,
        name: `Correction #${corr.id}: ${corr.kind}`,
        definition: corr.proposed,
      });
    }
  }
  return NextResponse.json({ ok: true });
}
