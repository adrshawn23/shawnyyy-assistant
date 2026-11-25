import { NextResponse } from "next/server";
import { listDriveFiles, analyzeDriveFile, connectionStatus, SHEET_MIME } from "@/services/drive";
import { getSessionEmail } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET /api/drive — connection status, or file listing (?list=1&query=&mime=&page=)
// POST /api/drive — analyze a file { fileId }
export async function GET(req: Request) {
  const email = await getSessionEmail();
  if (!email) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  const url = new URL(req.url);
  if (url.searchParams.get("status") === "1") {
    return NextResponse.json(await connectionStatus());
  }

  try {
    const result = await listDriveFiles({
      query: url.searchParams.get("query") || undefined,
      mimeType: url.searchParams.get("mime") || undefined,
      pageSize: Number(url.searchParams.get("pageSize")) || 50,
      pageToken: url.searchParams.get("page") || undefined,
    });
    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Drive request failed" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const email = await getSessionEmail();
  if (!email) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  const { fileId } = await req.json();
  if (!fileId) return NextResponse.json({ error: "fileId is required" }, { status: 400 });

  try {
    const analysis = await analyzeDriveFile(fileId);
    return NextResponse.json(analysis);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Analysis failed" }, { status: 500 });
  }
}
