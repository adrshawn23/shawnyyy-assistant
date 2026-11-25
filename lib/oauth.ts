// Google OAuth2 (user's own account) for Drive/Sheets read access.
// Tokens are stored in the oauth_tokens table and refreshed automatically.

import { google } from "googleapis";
import { db } from "@/db";
import { oauthTokens } from "@/db/schema";
import { eq } from "drizzle-orm";

export const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/drive.readonly",
  "https://www.googleapis.com/auth/spreadsheets",
];

export function oauthConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

function redirectUri(): string {
  return (
    process.env.GOOGLE_REDIRECT_URI ||
    `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/auth/google/callback`
  );
}

function oauth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    redirectUri()
  );
}

export function getAuthUrl(state?: string): string {
  const client = oauth2Client();
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent", // force refresh token
    scope: GOOGLE_SCOPES,
    state: state || "",
  });
}

export async function exchangeCode(code: string) {
  const client = oauth2Client();
  const { tokens } = await client.getToken(code);
  return tokens;
}

export async function saveTokens(tokens: {
  access_token?: string | null;
  refresh_token?: string | null;
  expiry_date?: number | null;
  scope?: string | null;
  id_token?: string | null;
}) {
  // Fetch the account email so we know whose Drive this is.
  let email: string | null = null;
  if (tokens.access_token) {
    try {
      const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      const info: any = await res.json();
      email = info.email || null;
    } catch { /* non-fatal */ }
  }

  const existing = (await db.select().from(oauthTokens).where(eq(oauthTokens.provider, "google")).limit(1))[0];
  const values = {
    accessToken: tokens.access_token || "",
    refreshToken: tokens.refresh_token || existing?.refreshToken || null,
    expiryDate: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
    scope: tokens.scope || GOOGLE_SCOPES.join(" "),
    email,
    updatedAt: new Date(),
  };
  if (existing) {
    await db.update(oauthTokens).set(values).where(eq(oauthTokens.id, existing.id));
  } else {
    await db.insert(oauthTokens).values({ provider: "google", ...values });
  }
  return { email };
}

export async function getStoredTokens() {
  return (await db.select().from(oauthTokens).where(eq(oauthTokens.provider, "google")).limit(1))[0] || null;
}

// Returns an authorized OAuth2 client for the stored user tokens, refreshing
// the access token when expired. Returns null when not connected.
export async function getUserOAuthClient(): Promise<InstanceType<typeof google.auth.OAuth2> | null> {
  const stored = await getStoredTokens();
  if (!stored?.accessToken) return null;

  const client = oauth2Client();
  client.setCredentials({
    access_token: stored.accessToken,
    refresh_token: stored.refreshToken || undefined,
    expiry_date: stored.expiryDate ? stored.expiryDate.getTime() : undefined,
  });

  // Proactively refresh if expired (or within 60s of expiry).
  const exp = stored.expiryDate?.getTime() || 0;
  if (exp && exp - Date.now() < 60_000 && stored.refreshToken) {
    try {
      const { credentials } = await client.refreshAccessToken();
      await db.update(oauthTokens).set({
        accessToken: credentials.access_token || stored.accessToken,
        expiryDate: credentials.expiry_date ? new Date(credentials.expiry_date) : stored.expiryDate,
        updatedAt: new Date(),
      }).where(eq(oauthTokens.id, stored.id));
      client.setCredentials(credentials);
    } catch {
      return null; // refresh failed — user must reconnect
    }
  }
  return client;
}

export async function disconnectGoogle() {
  await db.delete(oauthTokens).where(eq(oauthTokens.provider, "google"));
}
