// Deterministic data cleaning for hub shipment logs.
// Raw values are always preserved alongside cleaned values for review.

export interface ColumnMapping {
  trackingId: number; // column index
  hub: number;
  status: number;
  eventDate: number;
}

export interface CleanRule {
  hubAliases?: Record<string, string>; // lowercase raw -> canonical
  statusAliases?: Record<string, string>;
  canonicalHubs?: string[];
  canonicalStatuses?: string[];
}

export interface Flag {
  code: "missing_id" | "invalid_date" | "unknown_alias" | "missing_hub" | "duplicate" | "blank_row";
  message: string;
}

export interface CleanRow {
  rowNumber: number; // 1-based data row (excluding header)
  raw: string[];
  trackingId: string;
  hub: string;
  status: string;
  eventDate: string; // ISO yyyy-mm-dd or ""
  flags: Flag[];
  excluded: boolean; // flagged rows are excluded from KPI totals
}

export interface CleanResult {
  mapping: ColumnMapping;
  headerSignature: string;
  rows: CleanRow[];
  stats: {
    sourceRows: number;
    cleanRows: number;
    flaggedRows: number;
    duplicateRows: number;
    repeatedEvents: number;
  };
}

// ---------- header mapping ----------

const HEADER_HINTS: Record<keyof ColumnMapping, RegExp[]> = {
  trackingId: [/track/i, /\bid\b/i, /reference/i, /ref\b/i, /awb/i],
  hub: [/hub/i, /station/i, /branch/i, /origin/i, /location/i],
  status: [/status/i, /state/i, /stage/i],
  eventDate: [/event.*date/i, /date/i, /timestamp/i, /time/i, /scan.*date/i],
};

export function detectMapping(headers: string[]): ColumnMapping | null {
  const lower = headers.map((h) => h.trim().toLowerCase());
  const find = (key: keyof ColumnMapping) => {
    for (const re of HEADER_HINTS[key]) {
      const idx = lower.findIndex((h) => re.test(h));
      if (idx >= 0) return idx;
    }
    return -1;
  };
  const mapping: ColumnMapping = {
    trackingId: find("trackingId"),
    hub: find("hub"),
    status: find("status"),
    eventDate: find("eventDate"),
  };
  if (mapping.trackingId < 0 || mapping.hub < 0 || mapping.status < 0 || mapping.eventDate < 0) {
    return null;
  }
  return mapping;
}

export function headerSignature(headers: string[]): string {
  return headers.map((h) => h.trim().toLowerCase()).join("|");
}

// ---------- value normalization ----------

export function normalizeDate(raw: string): { iso: string; ok: boolean } {
  const s = raw.trim();
  if (!s) return { iso: "", ok: false };
  // ISO yyyy-mm-dd
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return valid(+m[1], +m[2], +m[3]);
  // M/D/YYYY or MM/DD/YYYY
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return valid(+m[3], +m[1], +m[2]);
  // DD-Mon-YYYY e.g. 18-Nov-2026
  m = s.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
  if (m) {
    const months: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
    const mo = months[m[2].toLowerCase()];
    if (mo) return valid(+m[3], mo, +m[1]);
  }
  const d = new Date(s);
  if (!isNaN(d.getTime()) && /\d{4}/.test(s)) {
    return { iso: d.toISOString().slice(0, 10), ok: true };
  }
  return { iso: "", ok: false };
}

function valid(y: number, mo: number, d: number) {
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || y < 2000 || y > 2100) {
    return { iso: "", ok: false };
  }
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return { iso: "", ok: false };
  return { iso: `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`, ok: true };
}

function titleCase(s: string): string {
  return s.replace(/\w\S*/g, (w) => w[0].toUpperCase() + w.slice(1).toLowerCase());
}

// ---------- cleaning ----------

export function cleanRows(
  dataRows: string[][],
  mapping: ColumnMapping,
  rules: CleanRule = {}
): CleanResult {
  const hubAliases = rules.hubAliases || {};
  const statusAliases = rules.statusAliases || {};
  const canonicalHubs = new Set((rules.canonicalHubs || []).map((h) => h.toLowerCase()));
  const canonicalStatuses = new Set((rules.canonicalStatuses || []).map((s) => s.toLowerCase()));

  const rows: CleanRow[] = [];
  const seenExact = new Map<string, number[]>(); // accidental duplicate detection
  const seenEvents = new Map<string, Set<string>>(); // shipment -> set of event signatures

  dataRows.forEach((raw, i) => {
    const rowNumber = i + 1;
    const cell = (idx: number) => (idx >= 0 && idx < raw.length ? String(raw[idx] ?? "") : "");

    const trackingId = cell(mapping.trackingId).trim(); // leading zeros preserved: never Number()
    const hubRaw = cell(mapping.hub).trim();
    const statusRaw = cell(mapping.status).trim();
    const dateRaw = cell(mapping.eventDate).trim();

    const flags: Flag[] = [];
    const allBlank = raw.every((c) => !String(c ?? "").trim());
    if (allBlank) {
      rows.push({ rowNumber, raw, trackingId: "", hub: "", status: "", eventDate: "", flags: [{ code: "blank_row", message: "Entire row is blank" }], excluded: true });
      return;
    }
    if (!trackingId) flags.push({ code: "missing_id", message: "Missing Tracking ID" });
    if (!hubRaw) flags.push({ code: "missing_hub", message: "Missing Hub" });

    // hub alias resolution
    let hub = "";
    if (hubRaw) {
      const key = hubRaw.toLowerCase();
      if (hubAliases[key]) hub = hubAliases[key];
      else if (canonicalHubs.size === 0 || canonicalHubs.has(key)) hub = titleCase(hubRaw);
      else {
        hub = titleCase(hubRaw);
        flags.push({ code: "unknown_alias", message: `Unknown hub alias "${hubRaw}"` });
      }
    }

    // status alias resolution
    let status = "";
    if (statusRaw) {
      const key = statusRaw.toLowerCase();
      if (statusAliases[key]) status = statusAliases[key];
      else if (canonicalStatuses.size === 0 || canonicalStatuses.has(key)) status = titleCase(statusRaw);
      else {
        status = titleCase(statusRaw);
        flags.push({ code: "unknown_alias", message: `Unknown status alias "${statusRaw}"` });
      }
    }

    const { iso: eventDate, ok: dateOk } = normalizeDate(dateRaw);
    if (dateRaw && !dateOk) flags.push({ code: "invalid_date", message: `Invalid date "${dateRaw}"` });
    if (!dateRaw) flags.push({ code: "invalid_date", message: "Missing event date" });

    // duplicate classification
    const exactKey = [trackingId, hub.toLowerCase(), status.toLowerCase(), eventDate].join("|");
    const eventKey = `${trackingId}|${status.toLowerCase()}|${eventDate}`;
    if (trackingId) {
      if (seenExact.has(exactKey)) {
        flags.push({ code: "duplicate", message: "Accidental duplicate — identical to an earlier row" });
      } else {
        seenExact.set(exactKey, [rowNumber]);
      }
      const ev = seenEvents.get(trackingId) || new Set<string>();
      if (ev.has(eventKey)) {
        // same shipment + same status + same date but different other fields → still suspicious
        flags.push({ code: "duplicate", message: "Possible duplicate event for this shipment" });
      } else {
        ev.add(eventKey);
        seenEvents.set(trackingId, ev);
      }
    }

    rows.push({
      rowNumber, raw, trackingId, hub, status, eventDate,
      flags, excluded: flags.length > 0,
    });
  });

  const flaggedRows = rows.filter((r) => r.excluded).length;
  const duplicateRows = rows.filter((r) => r.flags.some((f) => f.code === "duplicate")).length;
  // repeated shipment events: same tracking id appearing with different event signatures
  const byId = new Map<string, Set<string>>();
  rows.filter((r) => r.trackingId).forEach((r) => {
    const s = byId.get(r.trackingId) || new Set<string>();
    s.add(`${r.status}|${r.eventDate}`);
    byId.set(r.trackingId, s);
  });
  const repeatedEvents = [...byId.values()].filter((s) => s.size > 1).length;

  return {
    mapping,
    headerSignature: "",
    rows,
    stats: {
      sourceRows: dataRows.length,
      cleanRows: rows.length - flaggedRows,
      flaggedRows,
      duplicateRows,
      repeatedEvents,
    },
  };
}
