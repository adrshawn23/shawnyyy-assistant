import { NextResponse } from "next/server";
import { listJobs } from "@/services/learning";
import { jobStatus } from "@/services/jobs";
import { getSessionEmail } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const email = await getSessionEmail();
  if (!email) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (id) {
    const { getJob } = await import("@/services/learning");
    const job = await getJob(parseInt(id));
    return NextResponse.json({ job });
  }
  const jobs = await listJobs(50);
  return NextResponse.json({ jobs });
}
