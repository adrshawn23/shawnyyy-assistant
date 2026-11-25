import { NextResponse } from "next/server";
import { listRules, setRuleStatus, restoreRuleVersion } from "@/services/learning";
import { getSessionEmail } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const email = await getSessionEmail();
  if (!email) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const wb = searchParams.get("workbookId");
  const rules = await listRules(wb ? parseInt(wb) : undefined);
  return NextResponse.json({ rules });
}

export async function POST(req: Request) {
  const email = await getSessionEmail();
  if (!email) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const { ruleId, action } = await req.json();
  if (!ruleId) return NextResponse.json({ error: "ruleId required" }, { status: 400 });
  if (action === "disable") await setRuleStatus(ruleId, "disabled");
  else if (action === "enable") await setRuleStatus(ruleId, "active");
  else if (action === "restore") await restoreRuleVersion(ruleId);
  else return NextResponse.json({ error: "unknown action" }, { status: 400 });
  return NextResponse.json({ ok: true });
}
