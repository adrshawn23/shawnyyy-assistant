import { google } from "googleapis";
import { env, isDemo } from "./env";
import { demoRead, demoWrite, demoMeta } from "./demo-data";
import { getUserOAuthClient, oauthConfigured } from "./oauth";

export function extractSpreadsheetId(url: string): string | null {
  const m = url.match(/\/d\/([a-zA-Z0-9-_]+)/) || url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return m ? m[1] : null;
}

export function serviceAccountEmail(): string {
  if (env.serviceAccountJson) {
    try {
      const key = JSON.parse(env.serviceAccountJson);
      if (key.client_email) return key.client_email;
    } catch { /* fall through */ }
  }
  return env.serviceAccountEmail;
}

// ---------- Google Sheets via company service account ----------

let sheetsClient: ReturnType<typeof google.sheets> | null = null;
let driveClient: ReturnType<typeof google.drive> | null = null;

function getServiceAccountAuth() {
  const raw = env.serviceAccountJson;
  if (!raw) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is not configured");
  const key = JSON.parse(raw);
  return new google.auth.JWT({
    email: key.client_email,
    key: key.private_key,
    scopes: [
      "https://www.googleapis.com/auth/spreadsheets",
      "https://www.googleapis.com/auth/drive.readonly",
    ],
  });
}

// Auth resolution: prefer the connected user's OAuth tokens (their own Drive),
// fall back to the company service account.
export async function getAuth(): Promise<any> {
  if (oauthConfigured()) {
    const user = await getUserOAuthClient();
    if (user) return user;
  }
  return getServiceAccountAuth();
}

async function getSheets() {
  if (isDemo()) return null;
  if (!sheetsClient) {
    sheetsClient = google.sheets({ version: "v4", auth: await getAuth() });
  }
  return sheetsClient;
}

export async function getDrive() {
  if (isDemo()) return null;
  if (!driveClient) {
    driveClient = google.drive({ version: "v3", auth: await getAuth() });
  }
  return driveClient;
}

export type SheetValues = string[][];

export interface SheetBackend {
  readValues(spreadsheetId: string, range: string): Promise<SheetValues>;
  writeValues(spreadsheetId: string, range: string, values: SheetValues): Promise<void>;
  getMeta(spreadsheetId: string): Promise<{ title: string; tabs: string[] }>;
}

// ---------- Office file fallback (.xlsx/.xls/.csv on Drive) ----------
// Google Sheets API rejects Office files; download via Drive and parse with SheetJS.

async function readOfficeValues(spreadsheetId: string, range: string): Promise<SheetValues | null> {
  try {
    const drive = await getDrive();
    if (!drive) return null;
    const res = await drive.files.get(
      { fileId: spreadsheetId, alt: "media", supportsAllDrives: true },
      { responseType: "arraybuffer" }
    );
    const XLSX = await import("xlsx");
    const wb = XLSX.read(res.data as ArrayBuffer, { type: "array" });
    // Range looks like "Tab Name!A1:Z5000" — pick the named sheet, else first.
    const sheetName = range.includes("!") ? range.split("!")[0].replace(/^'|'$/g, "") : wb.SheetNames[0];
    const ws = wb.Sheets[sheetName] || wb.Sheets[wb.SheetNames[0]];
    if (!ws) return null;
    const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: "" });
    return rows.map((r) => (r as unknown[]).map((c) => String(c ?? "")));
  } catch {
    return null;
  }
}

function isOfficeFileError(e: any): boolean {
  const msg = String(e?.message || e?.errors?.[0]?.message || "");
  return /office file|not supported for this document/i.test(msg);
}

// Real backend (OAuth user or service account) or demo backend (sample data).
export async function getBackend(): Promise<SheetBackend> {
  if (isDemo()) {
    return {
      readValues: (id, range) => demoRead(id, range),
      writeValues: (id, range, values) => demoWrite(id, range, values),
      getMeta: (id) => demoMeta(id),
    };
  }
  const sheets = (await getSheets())!;
  return {
    async readValues(spreadsheetId, range) {
      try {
        const res = await sheets.spreadsheets.values.get({ spreadsheetId, range });
        return (res.data.values || []) as SheetValues;
      } catch (e) {
        if (isOfficeFileError(e)) {
          const office = await readOfficeValues(spreadsheetId, range);
          if (office) return office;
        }
        throw e;
      }
    },
    async writeValues(spreadsheetId, range, values) {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range,
        valueInputOption: "RAW", // preserve leading zeros / exact strings
        requestBody: { values },
      });
    },
    async getMeta(spreadsheetId) {
      const res = await sheets.spreadsheets.get({ spreadsheetId });
      return {
        title: res.data.properties?.title || spreadsheetId,
        tabs: (res.data.sheets || []).map((s) => s.properties?.title || ""),
      };
    },
  };
}

// ---------- Access verification ----------
// Distinguishes: success (viewer read OK), denied (403/404), error (network/config).

export type VerifyResult =
  | { result: "success"; detail: string }
  | { result: "denied"; detail: string }
  | { result: "error"; detail: string };

export async function verifyViewerAccess(spreadsheetId: string): Promise<VerifyResult> {
  if (isDemo()) {
    return { result: "success", detail: "Demo mode: simulated Viewer access verified." };
  }
  try {
    const sheets = (await getSheets())!;
    await sheets.spreadsheets.values.get({ spreadsheetId, range: "A1:A1" });
    return { result: "success", detail: "Read succeeded under Shawn's service account (Viewer confirmed)." };
  } catch (e: any) {
    const code = e?.code ?? e?.response?.status;
    const reason = e?.errors?.[0]?.reason || e?.message || String(e);
    if (code === 403 || code === 404) {
      return { result: "denied", detail: `Access denied (${code}): ${reason}` };
    }
    return { result: "error", detail: `Verification failed (${code ?? "network"}): ${reason}` };
  }
}

// Editor verification: a read proves Viewer only. Editor is confirmed via the
// Drive permissions API (role writer/organizer/fileOrganizer) for the service
// account email. Falls back to 'denied'/'error' honestly.
export async function verifyEditorAccess(spreadsheetId: string): Promise<VerifyResult> {
  if (isDemo()) {
    return { result: "success", detail: "Demo mode: simulated Editor access verified." };
  }
  try {
    // Identity depends on which auth is active: connected user (OAuth) or service account.
    let me = serviceAccountEmail();
    let isUserOAuth = false;
    if (oauthConfigured()) {
      const { getStoredTokens } = await import("./oauth");
      const stored = await getStoredTokens();
      if (stored?.accessToken) {
        me = stored.email || me;
        isUserOAuth = true;
      }
    }
    const auth = await getAuth();
    const drive = google.drive({ version: "v3", auth });
    const res = await drive.permissions.list({
      fileId: spreadsheetId,
      fields: "permissions(emailAddress,role)",
      supportsAllDrives: true,
    });
    const perm = (res.data.permissions || []).find(
      (p) => p.emailAddress?.toLowerCase() === me.toLowerCase()
    );
    if (perm && ["writer", "owner", "organizer", "fileOrganizer"].includes(perm.role || "")) {
      return { result: "success", detail: `Drive permission '${perm.role}' confirmed for ${me}.` };
    }
    if (perm) {
      return { result: "denied", detail: `${isUserOAuth ? "Connected account" : "Service account"} has role '${perm.role}' — Editor required.` };
    }
    return { result: "denied", detail: `${isUserOAuth ? "Connected account" : "Service account"} has no explicit permission on this workbook.` };
  } catch (e: any) {
    const code = e?.code ?? e?.response?.status;
    const reason = e?.errors?.[0]?.reason || e?.message || String(e);
    if (code === 403 || code === 404) {
      return { result: "denied", detail: `Access denied (${code}): ${reason}` };
    }
    return { result: "error", detail: `Editor verification failed (${code ?? "network"}): ${reason}` };
  }
}
