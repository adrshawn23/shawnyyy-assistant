// In-memory demo workbooks. Used when DEMO_MODE=true (no Google credentials).
// Covers: leading-zero IDs, repeated shipment events, blanks, invalid dates,
// inconsistent hub names, out-of-order "Daily Entry" log.

import type { SheetValues } from "./google";

const DEMO_SOURCE_ID = "demo-hub-raw";
const DEMO_REPORT_ID = "demo-hub-report";
const DEMO_LOG_ID = "demo-daily-entry";

// Raw tab: headers + messy rows. Columns: Tracking ID | Hub | Status | Event Date | Notes
const RAW_HEADERS = ["Tracking ID", "Hub", "Status", "Event Date", "Notes"];

const RAW_ROWS: string[][] = [
  ["TRK-001", "Cebu Hub", "Received", "2026-11-17", "first scan"],
  ["TRK-002", "cebu hub ", "In Transit", "2026-11-17", ""],
  ["TRK-003", "Davao Hub", "Delivered", "11/18/2026", "signed"],
  ["TRK-004", "Manila Hub", "Received", "2026-11-18", ""],
  ["TRK-005", "CEBU HUB", "In Transit", "2026-11-18", ""],
  ["TRK-006", "Davao Hub", "Exception", "not-a-date", "damaged"],
  ["TRK-007", "", "Received", "2026-11-19", "missing hub"],
  ["TRK-008", "Manila Hub", "Delivered", "2026-11-19", ""],
  ["TRK-009", "Cebu Hub", "Received", "2026-11-20", "repeat event 1"],
  ["TRK-009", "Cebu Hub", "In Transit", "2026-11-20", "repeat event 2 — same shipment, different event"],
  ["TRK-010", "Davao Hub", "Unknown Status", "2026-11-20", "alias test"],
  ["TRK-011", "Manila Hub", "Received", "", "blank date"],
  ["TRK-012", "Cebu Hub", "Delivered", "2026-11-21", ""],
  ["TRK-013", "Davao Hub", "In Transit", "2026-11-21", ""],
  ["TRK-014", "Manila Hub", "Received", "2026-11-22", ""],
  ["TRK-015", "CEBU HUB", "Exception", "2026-11-22", ""],
  ["TRK-016", "Davao Hub", "Delivered", "2026-11-23", ""],
  ["TRK-017", "Manila Hub", "In Transit", "2026-11-23", ""],
  ["TRK-018", "Cebu Hub", "Received", "2026-11-24", ""],
  ["TRK-019", "Davao Hub", "Received", "2026-11-24", ""],
  ["TRK-020", "Manila Hub", "Delivered", "2026-11-25", ""],
  // exact duplicate row (accidental)
  ["TRK-021", "Cebu Hub", "Received", "2026-11-25", "dup"],
  ["TRK-021", "Cebu Hub", "Received", "2026-11-25", "dup"],
  // leading-zero style ID preserved as string
  ["007123", "Davao Hub", "Received", "2026-11-25", "leading zeros"],
];

// Out-of-order append log for latest-match formula demo.
// Columns: Entry | Timestamp | Hub | Status | Tracking ID
const LOG_HEADERS = ["Entry", "Timestamp", "Hub", "Status", "Tracking ID"];
const LOG_ROWS: string[][] = [
  ["1", "2026-11-20 08:00", "Cebu Hub", "Received", "TRK-101"],
  ["2", "2026-11-21 09:30", "Davao Hub", "In Transit", "TRK-102"],
  ["3", "2026-11-19 07:15", "Manila Hub", "Delivered", "TRK-103"], // out of order
  ["4", "2026-11-22 10:00", "Cebu Hub", "Exception", "TRK-101"],
  ["5", "2026-11-23 11:45", "Davao Hub", "Delivered", "TRK-102"],
];

// Reporting workbook starts empty; Shawn writes here.
const REPORT_TABS = ["Clean Data", "Exceptions", "KPIs", "Daily Trend", "Hub Comparison"];

interface DemoBook {
  title: string;
  tabs: Record<string, SheetValues>;
}

const books = new Map<string, DemoBook>();

function ensure(id: string) {
  if (!books.has(id)) {
    if (id === DEMO_SOURCE_ID) {
      books.set(id, {
        title: "DEMO — Hub Raw Data",
        tabs: { "Raw Data": [RAW_HEADERS, ...RAW_ROWS] },
      });
    } else if (id === DEMO_LOG_ID) {
      books.set(id, {
        title: "DEMO — Daily Entry Log",
        tabs: { "Daily Entry": [LOG_HEADERS, ...LOG_ROWS] },
      });
    } else if (id === DEMO_REPORT_ID) {
      books.set(id, { title: "DEMO — Hub Report (Reporting)", tabs: {} });
    } else {
      books.set(id, { title: `Demo workbook ${id}`, tabs: {} });
    }
  }
  return books.get(id)!;
}

export function demoSpreadsheetIds(): string[] {
  return [DEMO_SOURCE_ID, DEMO_REPORT_ID, DEMO_LOG_ID];
}

export async function demoRead(id: string, range: string): Promise<SheetValues> {
  const book = ensure(id);
  const [tab, cells] = range.split("!");
  const tabName = tab || Object.keys(book.tabs)[0] || "";
  const grid = book.tabs[tabName] || [];
  if (!cells) return grid;
  // Minimal A1 parsing: support "A1:D100" style ranges.
  const m = cells.match(/^([A-Z]+)(\d+)(?::([A-Z]+)(\d+))?$/i);
  if (!m) return grid;
  const colToIdx = (c: string) => {
    let n = 0;
    for (const ch of c.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
    return n - 1;
  };
  const r1 = parseInt(m[2]) - 1;
  const r2 = m[4] ? parseInt(m[4]) - 1 : r1;
  const c1 = colToIdx(m[1]);
  const c2 = m[3] ? colToIdx(m[3]) : c1;
  return grid.slice(r1, r2 + 1).map((row) => row.slice(c1, c2 + 1));
}

export async function demoWrite(id: string, range: string, values: SheetValues): Promise<void> {
  const book = ensure(id);
  const [tab] = range.split("!");
  const tabName = tab || "Sheet1";
  if (!book.tabs[tabName]) book.tabs[tabName] = [];
  const grid = book.tabs[tabName];
  // Parse start cell e.g. "A1" or "Clean Data!A1"
  const cellPart = range.split("!")[1] || "A1";
  const m = cellPart.match(/^([A-Z]+)(\d+)/i);
  const colToIdx = (c: string) => {
    let n = 0;
    for (const ch of c.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
    return n - 1;
  };
  const startCol = m ? colToIdx(m[1]) : 0;
  const startRow = m ? parseInt(m[2]) - 1 : 0;
  values.forEach((row, i) => {
    const r = startRow + i;
    if (!grid[r]) grid[r] = [];
    row.forEach((v, j) => {
      grid[r][startCol + j] = String(v);
    });
  });
}

export async function demoMeta(id: string) {
  const book = ensure(id);
  return { title: book.title, tabs: Object.keys(book.tabs) };
}

// Demo "reporting" workbook gets its tabs created on first write.
export function demoReset() {
  books.clear();
}
