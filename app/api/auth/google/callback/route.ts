import { NextResponse } from "next/server";
import { exchangeCode, saveTokens } from "@/lib/oauth";

export const dynamic = "force-dynamic";

// GET /api/auth/google/callback — Google redirects here after consent.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  if (error) {
    return NextResponse.redirect(`${appUrl}/drive?error=${encodeURIComponent(error)}`);
  }
  if (!code) {
    return NextResponse.redirect(`${appUrl}/drive?error=missing_code`);
  }

  try {
    const tokens = await exchangeCode(code);
    const { email } = await saveTokens(tokens);
    return NextResponse.redirect(`${appUrl}/drive?connected=${encodeURIComponent(email || "yes")}`);
  } catch (e: any) {
    console.error("google oauth callback error", e);
    return NextResponse.redirect(`${appUrl}/drive?error=${encodeURIComponent(e?.message || "token_exchange_failed")}`);
  }
}
