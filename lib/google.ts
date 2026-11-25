import { google } from "googleapis";
import { env, isDemo } from "./env";
import { demoRead, demoWrite, demoMeta } from "./demo-data";

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

function getSheets() {
  if (isDemo()) return null;
  if (!sheetsClient) {
    sheetsClient = google.sheets({ version: "v4", auth: getServiceAccountAuth() });
  }
  return sheetsClient;
}

export type SheetValues = string[][];

export interface SheetBackend {
  readValues(spreadsheetId: string, range: string): Promise<SheetValues>;
  writeValues(spreadsheetId: string, range: string, values: SheetValues): Promise<void>;
  getMeta(spreadsheetId: string): Promise<{ title: string; tabs: string[] }>;
}

// Real backend (service account) or demo backend (in-memory sample data).
export function getBackend(): SheetBackend {
  if (isDemo()) {
    return {
      readValues: (id, range) => demoRead(id, range),
      writeValues: (id, range, values) => demoWrite(id, range, values),
      getMeta: (id) => demoMeta(id),
    };
  }
  const sheets = getSheets()!;
  return {
    async readValues(spreadsheetId, range) {
      const res = await sheets.spreadsheets.values.get({ spreadsheetId, range });
      return (res.data.values || []) as SheetValues;
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
    const sheets = getSheets()!;
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
    const auth = getServiceAccountAuth();
    const drive = google.drive({ version: "v3", auth });
    const res = await drive.permissions.list({
      fileId: spreadsheetId,
      fields: "permissions(emailAddress,role)",
      supportsAllDrives: true,
    });
    const me = serviceAccountEmail();
    const perm = (res.data.permissions || []).find(
      (p) => p.emailAddress?.toLowerCase() === me.toLowerCase()
    );
    if (perm && ["writer", "owner", "organizer", "fileOrganizer"].includes(perm.role || "")) {
      return { result: "success", detail: `Drive permission '${perm.role}' confirmed for ${me}.` };
    }
    if (perm) {
      return { result: "denied", detail: `Service account has role '${perm.role}' — Editor required.` };
    }
    return { result: "denied", detail: "Service account has no explicit permission on this workbook." };
  } catch (e: any) {
    const code = e?.code ?? e?.response?.status;
    const reason = e?.errors?.[0]?.reason || e?.message || String(e);
    if (code === 403 || code === 404) {
      return { result: "denied", detail: `Access denied (${code}): ${reason}` };
    }
    return { result: "error", detail: `Editor verification failed (${code ?? "network"}): ${reason}` };
  }
}
