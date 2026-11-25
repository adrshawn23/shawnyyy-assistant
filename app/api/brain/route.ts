import { NextResponse } from "next/server";
import { brainStatus, getScanState, startBrainScan } from "@/services/brain";
import { getSessionEmail } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET /api/brain — brain status + scan state (poll while scanning)
// POST /api/brain — start a background Drive scan (returns immediately)
export async function GET() {
  const email = await getSessionEmail();
  if (!email) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const status = await brainStatus();
  const scan = getScanState();
  return NextResponse.json({
    ...status,
    scanning: scan.running,
    progress: scan.progress || null,
    scanStartedAt: scan.startedAt || null,
    lastResult: scan.lastResult || null,
    lastError: scan.lastError || null,
  });
}

export async function POST() {
  const email = await getSessionEmail();
  if (!email) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const { started } = startBrainScan();
  return NextResponse.json({ started, message: started ? "Scan started" : "Scan already running" });
}
