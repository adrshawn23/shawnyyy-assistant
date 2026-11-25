// Drive browsing + analysis using the connected Google account (OAuth) or the
// service account. Read-only: lists files and summarizes/analyzes Sheets.

import { getDrive, getBackend } from "@/lib/google";
import { getStoredTokens, oauthConfigured } from "@/lib/oauth";

export const SHEET_MIME = "application/vnd.google-apps.spreadsheet";
export const DOC_MIME = "application/vnd.google-apps.document";

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
  size?: string;
  webViewLink?: string;
  owners?: { displayName?: string; emailAddress?: string }[];
}

export async function connectionStatus() {
  const configured = oauthConfigured();
  const stored = configured ? await getStoredTokens() : null;
  return {
    oauthConfigured: configured,
    connected: Boolean(stored?.accessToken),
    email: stored?.email || null,
    scope: stored?.scope || null,
  };
}

export async function listDriveFiles(opts: {
  query?: string;
  mimeType?: string;
  pageSize?: number;
  pageToken?: string;
} = {}): Promise<{ files: DriveFile[]; nextPageToken?: string }> {
  const drive = await getDrive();
  if (!drive) throw new Error("Google Drive is not available (demo mode or missing credentials).");

  const qParts: string[] = ["trashed = false"];
  if (opts.mimeType) qParts.push(`mimeType = '${opts.mimeType}'`);
  if (opts.query) {
    const safe = opts.query.replace(/'/g, "\\'");
    qParts.push(`(name contains '${safe}' or fullText contains '${safe}')`);
  }

  const res = await drive.files.list({
    q: qParts.join(" and "),
    pageSize: Math.min(opts.pageSize || 50, 100),
    pageToken: opts.pageToken,
    fields: "nextPageToken, files(id,name,mimeType,modifiedTime,size,webViewLink,owners(displayName,emailAddress))",
    orderBy: "modifiedTime desc",
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  return {
    files: (res.data.files || []) as DriveFile[],
    nextPageToken: res.data.nextPageToken || undefined,
  };
}

export interface FileAnalysis {
  file: DriveFile;
  kind: "spreadsheet" | "document" | "other";
  summary: string;
  details: Record<string, any>;
}

export async function analyzeDriveFile(fileId: string): Promise<FileAnalysis> {
  const drive = await getDrive();
  if (!drive) throw new Error("Google Drive is not available.");

  const meta = await drive.files.get({
    fileId,
    fields: "id,name,mimeType,modifiedTime,size,webViewLink,owners(displayName,emailAddress)",
    supportsAllDrives: true,
  });
  const file = meta.data as DriveFile;

  if (file.mimeType === SHEET_MIME) {
    return analyzeSpreadsheet(file);
  }
  if (file.mimeType === DOC_MIME) {
    return {
      file,
      kind: "document",
      summary: `Google Doc "${file.name}" — ${file.size ? `${Math.round(Number(file.size) / 1024)} KB` : "size unknown"}, last modified ${file.modifiedTime?.slice(0, 10) || "unknown"}.`,
      details: { note: "Document content analysis not yet implemented; open in Drive to view." },
    };
  }
  return {
    file,
    kind: "other",
    summary: `"${file.name}" (${file.mimeType}) — not a Google Sheet/Doc.`,
    details: {},
  };
}

async function analyzeSpreadsheet(file: DriveFile): Promise<FileAnalysis> {
  const backend = await getBackend();
  const meta = await backend.getMeta(file.id);

  // Read the first tab's used range (capped) for structure analysis.
  const firstTab = meta.tabs[0] || "Sheet1";
  let grid: string[][] = [];
  try {
    grid = await backend.readValues(file.id, `${firstTab}!A1:Z500`);
  } catch { /* permission or empty */ }

  const headers = (grid[0] || []).map((h) => String(h).trim()).filter(Boolean);
  const rowCount = grid.length;
  const colCount = Math.max(0, ...grid.map((r) => r.length));

  // Non-empty cell count + per-column fill rate for a quick quality read.
  let filled = 0;
  const colFill: number[] = new Array(colCount).fill(0);
  for (const row of grid) {
    for (let c = 0; c < row.length; c++) {
      if (String(row[c] ?? "").trim() !== "") {
        filled++;
        colFill[c]++;
      }
    }
  }

  const summary = [
    `Google Sheet "${file.name}" with ${meta.tabs.length} tab(s): ${meta.tabs.slice(0, 8).join(", ")}${meta.tabs.length > 8 ? "…" : ""}.`,
    `Tab "${firstTab}": ~${rowCount} rows × ${colCount} columns, ${filled} filled cells.`,
    headers.length ? `Headers: ${headers.slice(0, 12).join(" | ")}${headers.length > 12 ? "…" : ""}.` : "No header row detected.",
  ].join(" ");

  return {
    file,
    kind: "spreadsheet",
    summary,
    details: {
      tabs: meta.tabs,
      firstTab,
      rows: rowCount,
      columns: colCount,
      filledCells: filled,
      headers,
      columnFillRate: colFill.map((n) => (rowCount ? Math.round((n / rowCount) * 100) : 0)),
    },
  };
}
