import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "crypto";
import { env } from "./env";

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

export function validLogin(email: string, password: string): boolean {
  if (!env.loginEmail || !env.loginPassword) return false;
  if (env.companyDomain && !email.toLowerCase().endsWith("@" + env.companyDomain.toLowerCase())) {
    return false;
  }
  return email.toLowerCase() === env.loginEmail.toLowerCase() && password === env.loginPassword;
}
