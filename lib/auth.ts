import { cookies } from "next/headers";
import { createHmac, timingSafeEqual, scryptSync, randomBytes } from "crypto";
import { env } from "./env";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

const COOKIE = "shawn_session";
const TTL_MS = 1000 * 60 * 60 * 12; // 12h

function sign(payload: string): string {
  return createHmac("sha256", env.authSecret).update(payload).digest("hex");
}

export async function createSession(email: string) {
  const exp = Date.now() + TTL_MS;
  const payload = Buffer.from(JSON.stringify({ email, exp })).toString("base64url");
  const token = `${payload}.${sign(payload)}`;
  const store = await cookies();
  store.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: TTL_MS / 1000,
    path: "/",
  });
}

export async function destroySession() {
  const store = await cookies();
  store.delete(COOKIE);
}

export async function getSessionEmail(): Promise<string | null> {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = sign(payload);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (typeof data.exp !== "number" || data.exp < Date.now()) return null;
    return data.email as string;
  } catch {
    return null;
  }
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const candidate = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

// Login: shared env credential OR a DB user account.
export async function validLogin(email: string, password: string): Promise<boolean> {
  const e = email.toLowerCase();
  // Shared company credential (env) still works.
  if (env.loginEmail && env.loginPassword && e === env.loginEmail.toLowerCase() && password === env.loginPassword) {
    return true;
  }
  // DB user accounts.
  const user = (await db.select().from(users).where(eq(users.email, e)).limit(1))[0];
  if (user?.passwordHash && verifyPassword(password, user.passwordHash)) return true;
  return false;
}

export async function getSessionUser() {
  const email = await getSessionEmail();
  if (!email) return null;
  return (await db.select().from(users).where(eq(users.email, email.toLowerCase())).limit(1))[0] || null;
}
