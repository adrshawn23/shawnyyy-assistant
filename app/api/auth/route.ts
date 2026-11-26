import { NextResponse } from "next/server";
import { createSession, validLogin, destroySession, getSessionEmail } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { email, password } = await req.json();
  if (!email || !password) {
    return NextResponse.json({ error: "email and password required" }, { status: 400 });
  }
  if (!(await validLogin(email, password))) {
    return NextResponse.json({ error: "Invalid credentials or domain" }, { status: 401 });
  }
  await createSession(email);
  return NextResponse.json({ ok: true, email });
}

export async function DELETE() {
  await destroySession();
  return NextResponse.json({ ok: true });
}

export async function GET() {
  const email = await getSessionEmail();
  return NextResponse.json({ email });
}
