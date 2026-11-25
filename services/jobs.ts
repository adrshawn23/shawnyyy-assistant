// Job runner: resolves workbooks, enforces access, cleans, computes KPIs,
// reconciles, and writes ONLY to an approved reporting workbook/range.
// Writes are idempotent via jobs.idempotency_key.

import { db } from "@/db";
import { jobs, workbooks, accessRequests, rules } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getBackend, extractSpreadsheetId } from "@/lib/google";
import { isDemo } from "@/lib/env";
import { detectMapping, headerSignature, cleanRows, CleanRule, ColumnMapping } from "./cleaning";
import { computeKpis, reconcile, Period, KpiResult } from "./kpis";
import { verifyAccess } from "./access";
import { getActiveRules } from "./learning";
import { createHash } from "crypto";

export interface ResolvedWorkbook {
  id: number;
  spreadsheetId: string;
  url: string;
  name: string | null;
  isDemo: boolean;
}

export async function resolveWorkbook(urlOrId?: string): Promise<ResolvedWorkbook | null> {
  if (isDemo()) {
    // Demo defaults: source = demo-hub-raw, reporting = demo-hub-report
    const all = await db.select().from(workbooks);
    const src = all.find((w) => w.spreadsheetId === "demo-hub-raw")
      || (await db.insert(workbooks).values({
        spreadsheetId: "demo-hub-raw",
        url: "demo://hub-raw",
        name: "DEMO — Hub Raw Data",
        ownerEmail: "demo@company.local",
        isDemo: true,
      }).returning())[0];
    return { id: src.id, spreadsheetId: src.spreadsheetId!, url: src.url, name: src.name, isDemo: true };
  }
  if (!urlOrId) return null;
  const sid = extractSpreadsheetId(urlOrId) || urlOrId;
  const wb = (await db.select().from(workbooks).where(eq(workbooks.spreadsheetId, sid)).limit(1))[0];
  if (!wb) return null;
  return { id: wb.id, spreadsheetId: wb.spreadsheetId!, url: wb.url, name: wb.name, isDemo: wb.isDemo };
}

async function resolveReportingWorkbook(): Promise<ResolvedWorkbook | null> {
  if (isDemo()) {
    const all = await db.select().from(workbooks);
    const rep = all.find((w) => w.spreadsheetId === "demo-hub-report")
      || (await db.insert(workbooks).values({
        spreadsheetId: "demo-hub-report",
        url: "demo://hub-report",
        ownerEmail: "demo@company.local",
        name: "DEMO — Hub Report (Reporting)",
        isDemo: true,
      }).returning())[0];
    return { id: rep.id, spreadsheetId: rep.spreadsheetId!, url: rep.url, name: rep.name, isDemo: true };
  }
  // Reporting workbook must be a separately authorized workbook with an
  // approved access request (role=editor). Pick the most recent verified one
  // that is NOT the source workbook.
  const reqs = await db.select().from(accessRequests).where(eq(accessRequests.status, "verified"));
  for (const r of reqs) {
    if (r.requestedRole !== "editor" || !r.workbookId) continue;
    const wb = (await db.select().from(workbooks).where(eq(workbooks.id, r.workbookId)).limit(1))[0];
    if (wb) return { id: wb.id, spreadsheetId: wb.spreadsheetId!, url: wb.url, name: wb.name, isDemo: wb.isDemo };
  }
  return null;
}

// Check that Shawn has verified access before use. Re-verify on every run.
async function ensureAccess(workbookId: number, need: "viewer" | "editor") {
  const reqs = await db.select().from(accessRequests).where(
    and(eq(accessRequests.workbookId, workbookId), eq(accessRequests.status, "verified"))
  );
  const ok = reqs.some((r) => (need === "editor" ? r.requestedRole === "editor" : true));
  if (!ok) {
    // attempt fresh verification
    const v = await verifyAccess(workbookId);
    const check = need === "editor" ? v.editor : v.viewer;
    if (!check || check.result !== "success") {
      throw new Error(`Access not verified for workbook ${workbookId} (${need}): ${check?.detail || "no request"}`);
    }
  }
}

function idempotencyKey(parts: string[]): string {
  return createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 32);
}

// ---------- hub report job ----------

export interface HubReportInput {
  command: string;
  workbookUrl?: string;
  tab?: string;
  period?: Period;
  reportingUrl?: string;
  skipWrite?: boolean; // clean_sheet: compute + reconcile but do not publish
}

export async function runHubReport(input: HubReportInput) {
  const src = await resolveWorkbook(input.workbookUrl);
  if (!src) {
    return { status: "needs_input" as const, message: "Which workbook? Please provide the Sheet URL (or run in demo mode)." };
  }

  const period = input.period || defaultPeriod();
  const key = idempotencyKey(["hub_report", String(src.id), period.start, period.end, input.tab || "Raw Data", input.skipWrite ? "clean" : "report"]);

  // Idempotent retry: reuse the existing job row for the same key.
  const existing = (await db.select().from(jobs).where(eq(jobs.idempotencyKey, key)).limit(1))[0];
  if (existing && existing.status === "completed") {
    return { status: "completed" as const, jobId: existing.id, cached: true, result: existing.result };
  }

  let job: any;
  if (existing) {
    [job] = await db.update(jobs).set({
      status: "pending", error: null, result: null, reconciliation: null, updatedAt: new Date(),
    }).where(eq(jobs.id, existing.id)).returning();
  } else {
    [job] = await db.insert(jobs).values({
      workbookId: src.id,
      type: "hub_report",
      command: input.command,
      status: "pending",
      periodStart: period.start,
      periodEnd: period.end,
      idempotencyKey: key,
    }).returning();
  }

  try {
    const { seedDemoAccess } = await import("./access");
    await seedDemoAccess();
    await ensureAccess(src.id, "viewer");

    // Load approved mapping rule for this workbook; detect header changes.
    const mappingRules = await getActiveRules(src.id, "mapping");
    const savedMapping = mappingRules[0]?.definition as { mapping?: ColumnMapping; headerSignature?: string } | undefined;

    const backend = await getBackend();
    const tab = input.tab || "Raw Data";
    const grid = await backend.readValues(src.spreadsheetId, `${tab}!A1:Z5000`);
    if (grid.length < 2) throw new Error(`Tab "${tab}" has no data rows.`);
    const headers = grid[0].map((h) => String(h));
    const sig = headerSignature(headers);
    const dataRows = grid.slice(1).map((r) => r.map((c) => String(c ?? "")));

    let mapping: ColumnMapping;
    let mappingSource = "detected";
    if (savedMapping?.mapping && savedMapping.headerSignature === sig) {
      mapping = savedMapping.mapping;
      mappingSource = "saved_rule";
    } else {
      const detected = detectMapping(headers);
      if (!detected) {
        await db.update(jobs).set({ status: "needs_input", error: "Could not detect required columns (Tracking ID, Hub, Status, Event Date).", updatedAt: new Date() }).where(eq(jobs.id, job.id));
        return { status: "needs_input" as const, jobId: job.id, message: "I couldn't find Tracking ID / Hub / Status / Event Date columns. Which columns should I use?" };
      }
      mapping = detected;
      if (savedMapping?.headerSignature && savedMapping.headerSignature !== sig) {
        // header changed — pause and ask before reusing
        await db.update(jobs).set({ status: "paused", error: "Headers changed since saved mapping; confirmation required.", updatedAt: new Date() }).where(eq(jobs.id, job.id));
        return { status: "paused" as const, jobId: job.id, message: "Headers changed since the saved mapping. Confirm the new column mapping before I continue." };
      }
    }

    // cleaning rules (aliases) from approved rules
    const cleanRules = await getActiveRules(src.id, "cleaning");
    const cleanRule: CleanRule = {};
    for (const r of cleanRules) {
      const d = r.definition as any;
      if (d.hubAliases) cleanRule.hubAliases = { ...cleanRule.hubAliases, ...d.hubAliases };
      if (d.statusAliases) cleanRule.statusAliases = { ...cleanRule.statusAliases, ...d.statusAliases };
      if (d.canonicalHubs) cleanRule.canonicalHubs = d.canonicalHubs;
      if (d.statusAliases) cleanRule.canonicalStatuses = Object.values(d.statusAliases);
    }

    const cleaned = cleanRows(dataRows, mapping, cleanRule);
    cleaned.headerSignature = sig;
    const kpi = computeKpis(cleaned.rows, period);
    const recon = reconcile(dataRows.length, cleaned.rows, kpi);

    if (!recon.ok) {
      await db.update(jobs).set({
        status: "paused",
        result: { cleaned: summarize(cleaned.rows), kpi, mapping, mappingSource, headers },
        reconciliation: recon,
        updatedAt: new Date(),
      }).where(eq(jobs.id, job.id));
      return { status: "paused" as const, jobId: job.id, message: `Reconciliation failed: ${recon.failures.join(" ")} Paused before publishing.`, reconciliation: recon };
    }

    // Write to reporting workbook — only after reconciliation passes.
    const rep = input.skipWrite ? null : await resolveReportingWorkbook();
    let writeInfo: any = input.skipWrite ? { skipped: "clean-only job" } : { skipped: "no reporting workbook authorized" };
    if (rep && rep.id !== src.id) {
      await ensureAccess(rep.id, "editor");
      writeInfo = await writeReport(rep, cleaned.rows, kpi, period, tab);
      await db.update(jobs).set({ reportingWorkbookId: rep.id }).where(eq(jobs.id, job.id));
    }

    const result = {
      mapping, mappingSource, headers,
      stats: cleaned.stats,
      kpi,
      exceptions: cleaned.rows.filter((r) => r.excluded).slice(0, 200),
      write: writeInfo,
      period,
      sourceTab: tab,
      freshness: new Date().toISOString(),
      appliedRules: { mapping: mappingSource, cleaningRules: cleanRules.length },
    };

    await db.update(jobs).set({
      status: "completed",
      result,
      reconciliation: recon,
      updatedAt: new Date(),
    }).where(eq(jobs.id, job.id));

    return { status: "completed" as const, jobId: job.id, result, reconciliation: recon };
  } catch (e: any) {
    await db.update(jobs).set({ status: "failed", error: e?.message || String(e), updatedAt: new Date() }).where(eq(jobs.id, job.id));
    return { status: "failed" as const, jobId: job.id, message: e?.message || String(e) };
  }
}

function defaultPeriod(): Period {
  const now = new Date();
  const day = now.getUTCDay();
  const monday = new Date(now);
  monday.setUTCDate(now.getUTCDate() - ((day + 6) % 7));
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  return { start: monday.toISOString().slice(0, 10), end: sunday.toISOString().slice(0, 10) };
}

function summarize(rows: any[]) {
  return rows.slice(0, 500).map((r) => ({
    row: r.rowNumber, id: r.trackingId, hub: r.hub, status: r.status, date: r.eventDate,
    flags: r.flags.map((f: any) => f.code),
  }));
}

// Write report tabs to the reporting workbook. Fixed approved ranges only.
async function writeReport(
  rep: ResolvedWorkbook,
  rows: any[],
  kpi: KpiResult,
  period: Period,
  sourceTab: string
) {
  const backend = await getBackend();
  const clean = rows.filter((r) => !r.excluded);
  const flagged = rows.filter((r) => r.excluded);

  const cleanValues: string[][] = [
    ["Tracking ID", "Hub", "Status", "Event Date", "Source Row"],
    ...clean.map((r) => [r.trackingId, r.hub, r.status, r.eventDate, String(r.rowNumber)]),
  ];
  const exceptionValues: string[][] = [
    ["Source Row", "Tracking ID", "Hub", "Status", "Event Date", "Flags"],
    ...flagged.map((r) => [String(r.rowNumber), r.trackingId, r.hub, r.status, r.eventDate, r.flags.map((f: any) => f.code).join(";")]),
  ];
  const kpiValues: string[][] = [
    ["KPI", "Value", "Unit", "Definition"],
    ["Total Events", String(kpi.totals.events), "events", "Clean rows in period (flagged rows excluded)"],
    ["Distinct Shipments", String(kpi.totals.shipments), "shipments", "Unique Tracking IDs among clean rows"],
    ["Reporting Period", `${period.start} to ${period.end}`, "-", `Source tab: ${sourceTab}`],
    ["Generated", new Date().toISOString(), "-", "Shawn hub report"],
  ];
  const trendValues: string[][] = [
    ["Date", "Events"],
    ...kpi.totals.dailyTrend.map((d) => [d.date, String(d.events)]),
  ];
  const hubValues: string[][] = [
    ["Hub", "Events", "Shipments"],
    ...kpi.totals.hubComparison.map((h) => [h.hub, String(h.events), String(h.shipments)]),
  ];
  const statusValues: string[][] = [
    ["Status", "Events"],
    ...Object.entries(kpi.totals.statusBreakdown).map(([s, n]) => [s, String(n)]),
  ];

  await backend.writeValues(rep.spreadsheetId, "Clean Data!A1", cleanValues);
  await backend.writeValues(rep.spreadsheetId, "Exceptions!A1", exceptionValues);
  await backend.writeValues(rep.spreadsheetId, "KPIs!A1", kpiValues);
  await backend.writeValues(rep.spreadsheetId, "Daily Trend!A1", trendValues);
  await backend.writeValues(rep.spreadsheetId, "Hub Comparison!A1", hubValues);
  await backend.writeValues(rep.spreadsheetId, "Status Breakdown!A1", statusValues);

  return { workbook: rep.spreadsheetId, tabs: ["Clean Data", "Exceptions", "KPIs", "Daily Trend", "Hub Comparison", "Status Breakdown"] };
}

// ---------- job status ----------

export async function jobStatus(jobId?: number) {
  if (jobId) {
    const j = (await db.select().from(jobs).where(eq(jobs.id, jobId)).limit(1))[0];
    return j ? formatJob(j) : { error: `Job ${jobId} not found` };
  }
  const recent = await db.select().from(jobs).orderBy(jobs.createdAt).limit(100);
  return recent.slice(-10).map(formatJob).reverse();
}

function formatJob(j: any) {
  return {
    id: j.id, type: j.type, status: j.status, command: j.command,
    period: j.periodStart ? `${j.periodStart} → ${j.periodEnd}` : null,
    reconciliation: j.reconciliation ? { ok: j.reconciliation.ok, failures: j.reconciliation.failures } : null,
    error: j.error, createdAt: j.createdAt,
  };
}
