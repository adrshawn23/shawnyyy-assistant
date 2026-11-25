import { NextResponse } from "next/server";
import { getAuthUrl, oauthConfigured, disconnectGoogle } from "@/lib/oauth";
import { getSessionEmail } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET /api/auth/google — start the Google OAuth consent flow.
export async function GET() {
  if (!oauthConfigured()) {
    return NextResponse.json(
      { error: "Google OAuth is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET." },
      { status: 400 }
    );
  }
  return NextResponse.redirect(getAuthUrl());
}

// DELETE /api/auth/google — disconnect the stored Google account.
export async function DELETE() {
  const email = await getSessionEmail();
  if (!email) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  await disconnectGoogle();
  return NextResponse.json({ ok: true });
}
