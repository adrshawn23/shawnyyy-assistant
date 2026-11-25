// "Shawn's brain": scans every Google Sheet in the connected Drive, learns
// its structure (columns, data types, cleaning patterns, KPIs, formulas) and
// stores the knowledge as rules in the database — the persistent memory Shawn
// uses for future jobs.

import { google } from "googleapis";
import { db } from "@/db";
import { rules, workbooks } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { SHEET_MIME } from "./drive";
import { getDrive, getBackend, getAuth } from "@/lib/google";

interface SheetInfo {
  id: string;
  name: string;
  modifiedTime?: string;
  webViewLink?: string;
}

async function listAllSheets(): Promise<SheetInfo[]> {
  const drive = await getDrive();
  if (!drive) throw new Error("Google Drive is not available.");
  const out: SheetInfo[] = [];
  let pageToken: string | undefined;
  do {
    const res = await drive.files.list({
      q: `mimeType = '${SHEET_MIME}' and trashed = false`,
      pageSize: 100,
      pageToken,
      fields: "nextPageToken, files(id,name,modifiedTime,webViewLink)",
      orderBy: "modifiedTime desc",
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });
    out.push(...((res.data.files || []) as SheetInfo[]));
    pageToken = res.data.nextPageToken || undefined;
  } while (pageToken);
  return out;
}

// Heuristic: guess which canonical field a header maps to.
function guessField(header: string): string | null {
  const h = header.toLowerCase();
  if (/track|awb|waybill|reference|ref\s*#|tn\b/.test(h)) return "trackingId";
  if (/date|time|timestamp|created|modified/.test(h)) return "date";
  if (/hub|branch|station|office|region|area/.test(h)) return "hub";
  if (/status|state|stage|progress/.test(h)) return "status";
  if (/customer|client|consignee|shipper|sender|receiver/.test(h)) return "party";
  if (/amount|total|value|price|cost|fee|charge/.test(h)) return "amount";
  if (/qty|quantity|count|number|no\.?$|id$|^id\b/.test(h)) return "quantity";
  if (/weight|kg|lbs/.test(h)) return "weight";
  if (/address|location|city|province/.test(h)) return "location";
  return null;
}

function isNumericColumn(values: string[]): boolean {
  const sample = values.filter((v) => v.trim() !== "").slice(0, 50);
  if (sample.length < 3) return false;
  const numeric = sample.filter((v) => /^-?[\d,]+(\.\d+)?$/.test(v.trim())).length;
  return numeric / sample.length > 0.8;
}

function hasLeadingZeros(values: string[]): boolean {
  return values.some((v) => /^0\d{2,}/.test(v.trim()));
}

async function analyzeSheetForBrain(file: SheetInfo) {
  const backend = await getBackend();
  const meta = await backend.getMeta(file.id);
  const firstTab = meta.tabs[0] || "Sheet1";

  // Read values AND formulas (to learn formula patterns).
  let grid: string[][] = [];
  let formulaGrid: string[][] = [];
  try {
    grid = await backend.readValues(file.id, `${firstTab}!A1:Z300`);
  } catch { /* unreadable tab */ }
  try {
    const auth = await getAuth();
    const sheets = google.sheets({ version: "v4", auth });
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: file.id,
      range: `${firstTab}!A1:Z300`,
      valueRenderOption: "FORMULA",
    });
    formulaGrid = (res.data.values || []) as string[][];
  } catch { /* formulas optional */ }

  const headers = (grid[0] || []).map((h) => String(h).trim());
  const colCount = Math.max(0, ...grid.map((r) => r.length));

  // Column profiles
  const columns: { header: string; field: string | null; numeric: boolean; leadingZeros: boolean; fillRate: number }[] = [];
  for (let c = 0; c < colCount; c++) {
    const header = headers[c] || `Column ${c + 1}`;
    const values = grid.slice(1).map((r) => String(r[c] ?? ""));
    const filled = values.filter((v) => v.trim() !== "").length;
    columns.push({
      header,
      field: guessField(header),
      numeric: isNumericColumn(values),
      leadingZeros: hasLeadingZeros(values),
      fillRate: grid.length > 1 ? Math.round((filled / (grid.length - 1)) * 100) : 0,
    });
  }

  // Formula patterns: collect distinct formula templates (normalized).
  const formulas = new Set<string>();
  for (const row of formulaGrid) {
    for (const cell of row) {
      const s = String(cell ?? "");
      if (s.startsWith("=")) formulas.add(s.replace(/\$?\d+/g, "#").slice(0, 120));
    }
  }

  return { meta, firstTab, headers, columns, formulas: [...formulas].slice(0, 20), rowCount: grid.length };
}

async function upsertRule(def: {
  workbookId?: number | null;
  type: string;
  name: string;
  definition: any;
}) {
  const existing = (await db.select().from(rules).where(
    and(eq(rules.type, def.type), eq(rules.name, def.name))
  ).limit(1))[0];
  if (existing) {
    await db.update(rules).set({
      definition: def.definition,
      workbookId: def.workbookId ?? existing.workbookId,
      status: "active",
      updatedAt: new Date(),
    }).where(eq(rules.id, existing.id));
    return "updated";
  }
  await db.insert(rules).values({
    workbookId: def.workbookId ?? null,
    type: def.type,
    name: def.name,
    definition: def.definition,
    status: "active",
  });
  return "created";
}

export interface BrainScanResult {
  sheetsScanned: number;
  rulesCreated: number;
  rulesUpdated: number;
  errors: string[];
  learned: { sheet: string; rules: string[] }[];
}

export async function scanDriveBrain(): Promise<BrainScanResult> {
  const sheets = await listAllSheets();
  const result: BrainScanResult = { sheetsScanned: 0, rulesCreated: 0, rulesUpdated: 0, errors: [], learned: [] };

  for (const file of sheets) {
    try {
      // Register the workbook so jobs/rules can reference it.
      let wb = (await db.select().from(workbooks).where(eq(workbooks.spreadsheetId, file.id)).limit(1))[0];
      if (!wb) {
        [wb] = await db.insert(workbooks).values({
          spreadsheetId: file.id,
          url: `https://docs.google.com/spreadsheets/d/${file.id}`,
          name: file.name,
          isDemo: false,
        }).returning();
      }

      const analysis = await analyzeSheetForBrain(file);
      const learned: string[] = [];

      // 1. Mapping rule: header → canonical field guesses.
      const mapping = analysis.columns
        .filter((c) => c.field)
        .map((c) => ({ header: c.header, field: c.field, fillRate: c.fillRate }));
      if (mapping.length) {
        const r = await upsertRule({
          workbookId: wb?.id,
          type: "mapping",
          name: `Brain: ${file.name} — column mapping`,
          definition: { source: "drive-scan", tab: analysis.firstTab, mapping, allHeaders: analysis.headers },
        });
        result[r === "created" ? "rulesCreated" : "rulesUpdated"]++;
        learned.push("mapping");
      }

      // 2. Cleaning rule: leading zeros, numeric columns, fill rates.
      const cleaningHints = {
        leadingZeroColumns: analysis.columns.filter((c) => c.leadingZeros).map((c) => c.header),
        numericColumns: analysis.columns.filter((c) => c.numeric).map((c) => c.header),
        lowFillColumns: analysis.columns.filter((c) => c.fillRate < 50 && c.fillRate > 0).map((c) => c.header),
        preserveLeadingZeros: true,
      };
      const r2 = await upsertRule({
        workbookId: wb?.id,
        type: "cleaning",
        name: `Brain: ${file.name} — cleaning patterns`,
        definition: { source: "drive-scan", tab: analysis.firstTab, ...cleaningHints },
      });
      result[r2 === "created" ? "rulesCreated" : "rulesUpdated"]++;
      learned.push("cleaning");

      // 3. KPI rule: numeric columns are KPI candidates.
      const kpiCols = analysis.columns.filter((c) => c.numeric).map((c) => c.header);
      if (kpiCols.length) {
        const r3 = await upsertRule({
          workbookId: wb?.id,
          type: "kpi",
          name: `Brain: ${file.name} — KPI candidates`,
          definition: { source: "drive-scan", tab: analysis.firstTab, numericColumns: kpiCols },
        });
        result[r3 === "created" ? "rulesCreated" : "rulesUpdated"]++;
        learned.push("kpi");
      }

      // 4. Formula rule: learned formula patterns from the sheet itself.
      if (analysis.formulas.length) {
        const r4 = await upsertRule({
          workbookId: wb?.id,
          type: "formula",
          name: `Brain: ${file.name} — formula patterns`,
          definition: { source: "drive-scan", tab: analysis.firstTab, formulas: analysis.formulas },
        });
        result[r4 === "created" ? "rulesCreated" : "rulesUpdated"]++;
        learned.push("formula");
      }

      result.sheetsScanned++;
      result.learned.push({ sheet: file.name, rules: learned });
    } catch (e: any) {
      result.errors.push(`${file.name}: ${e?.message || "failed"}`);
    }
  }

  return result;
}

// Background scan state so the API can return immediately and the UI can poll.
let scanState: { running: boolean; startedAt?: Date; lastResult?: BrainScanResult; lastError?: string } = { running: false };

export function getScanState() {
  return scanState;
}

export function startBrainScan(): { started: boolean } {
  if (scanState.running) return { started: false };
  scanState = { running: true, startedAt: new Date() };
  scanDriveBrain()
    .then((result) => { scanState = { running: false, lastResult: result }; })
    .catch((e) => { scanState = { running: false, lastError: e?.message || "scan failed" }; });
  return { started: true };
}

export async function brainStatus() {
  const all = await db.select().from(rules);
  const brain = all.filter((r) => String(r.name || "").startsWith("Brain:"));
  const byType: Record<string, number> = {};
  for (const r of brain) byType[r.type] = (byType[r.type] || 0) + 1;
  return { totalRules: all.length, brainRules: brain.length, byType };
}
