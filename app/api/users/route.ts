import { NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getSessionEmail, getSessionUser, hashPassword } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET /api/users — list accounts (any signed-in user)
export async function GET() {
  const email = await getSessionEmail();
  if (!email) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const all = await db.select({ id: users.id, email: users.email, name: users.name, role: users.role, createdAt: users.createdAt }).from(users);
  return NextResponse.json({ users: all });
}

// POST /api/users — create account { email, password, name?, role? }
// Only admins (or the shared env login, which has no DB row → treated as admin) can add users.
export async function POST(req: Request) {
  const email = await getSessionEmail();
  if (!email) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const me = await getSessionUser();
  const isAdmin = !me || me.role === "admin"; // env-login users have no DB row → admin
  if (!isAdmin) return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const { email: newEmail, password, name, role } = await req.json();
  if (!newEmail || !password || password.length < 6) {
    return NextResponse.json({ error: "email and password (min 6 chars) required" }, { status: 400 });
  }
  const e = String(newEmail).toLowerCase().trim();
  const existing = (await db.select().from(users).where(eq(users.email, e)).limit(1))[0];
  if (existing) return NextResponse.json({ error: "Account already exists" }, { status: 409 });

  const [user] = await db.insert(users).values({
    email: e,
    name: name || null,
    passwordHash: hashPassword(password),
    role: role === "admin" ? "admin" : "user",
  }).returning({ id: users.id, email: users.email, name: users.name, role: users.role });
  return NextResponse.json({ user });
}

// DELETE /api/users?id=N — remove account (admin only, cannot delete yourself)
export async function DELETE(req: Request) {
  const email = await getSessionEmail();
  if (!email) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const me = await getSessionUser();
  const isAdmin = !me || me.role === "admin";
  if (!isAdmin) return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const id = Number(new URL(req.url).searchParams.get("id"));
  const target = (await db.select().from(users).where(eq(users.id, id)).limit(1))[0];
  if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (target.email === email.toLowerCase()) return NextResponse.json({ error: "Cannot delete your own account" }, { status: 400 });
  await db.delete(users).where(eq(users.id, id));
  return NextResponse.json({ ok: true });
}
