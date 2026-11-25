// Learning: approved rules, corrections, and saved workflows.
// Rules never expand access or authorize writes — they only affect how Shawn
// interprets/cleans/formulas within already-authorized scope.

import { db } from "@/db";
import { rules, corrections, workflows, jobs } from "@/db/schema";
import { eq, and, desc, inArray } from "drizzle-orm";

// ---------- rules ----------

export async function listRules(workbookId?: number) {
  if (workbookId != null) {
    return db.select().from(rules).where(eq(rules.workbookId, workbookId)).orderBy(desc(rules.createdAt));
  }
  return db.select().from(rules).orderBy(desc(rules.createdAt));
}

export async function getActiveRules(workbookId: number, type?: string) {
  const all = await db.select().from(rules).where(eq(rules.workbookId, workbookId));
  return all.filter((r) => {
    if (r.status !== "active") return false;
    if (type && r.type !== type) return false;
    // scope check: null scope = this workbook only; scopeWorkbookIds may include others
    const scope = r.scopeWorkbookIds as number[] | null;
    if (scope && Array.isArray(scope) && !scope.includes(workbookId)) return false;
    return true;
  });
}

// Approve a correction-derived rule. scope: "once" | "workbook" | "selected"
export async function approveRule(opts: {
  workbookId: number | null;
  type: string;
  name: string;
  definition: any;
  scopeWorkbookIds?: number[] | null;
  supersedesId?: number;
}) {
  // deactivate previous version
  if (opts.supersedesId) {
    await db.update(rules).set({ status: "disabled", updatedAt: new Date() }).where(eq(rules.id, opts.supersedesId));
  }
  const prev = opts.supersedesId
    ? (await db.select().from(rules).where(eq(rules.id, opts.supersedesId)).limit(1))[0]
    : null;
  const [rule] = await db
    .insert(rules)
    .values({
      workbookId: opts.workbookId,
      scopeWorkbookIds: opts.scopeWorkbookIds ?? null,
      type: opts.type,
      name: opts.name,
      definition: opts.definition,
      version: (prev?.version || 0) + 1,
      status: "active",
      supersedesId: opts.supersedesId,
    })
    .returning();
  return rule;
}

export async function setRuleStatus(ruleId: number, status: "active" | "disabled") {
  await db.update(rules).set({ status, updatedAt: new Date() }).where(eq(rules.id, ruleId));
}

export async function restoreRuleVersion(ruleId: number) {
  const target = (await db.select().from(rules).where(eq(rules.id, ruleId)).limit(1))[0];
  if (!target?.supersedesId) return null;
  // reactivate the superseded version, deactivate current
  await db.update(rules).set({ status: "disabled", updatedAt: new Date() }).where(eq(rules.id, ruleId));
  await db.update(rules).set({ status: "active", updatedAt: new Date() }).where(eq(rules.id, target.supersedesId));
  return target.supersedesId;
}

// ---------- corrections ----------

export async function recordCorrection(opts: {
  jobId?: number;
  workbookId?: number;
  kind: string;
  previous: any;
  proposed: any;
}) {
  const [c] = await db.insert(corrections).values({
    jobId: opts.jobId, workbookId: opts.workbookId, kind: opts.kind,
    previous: opts.previous, proposed: opts.proposed, status: "pending",
  }).returning();
  return c;
}

export async function listCorrections(status?: string) {
  if (status) return db.select().from(corrections).where(eq(corrections.status, status)).orderBy(desc(corrections.createdAt));
  return db.select().from(corrections).orderBy(desc(corrections.createdAt));
}

export async function resolveCorrection(correctionId: number, resolution: "used_once" | "approved_workbook" | "approved_global" | "rejected") {
  await db.update(corrections).set({ status: resolution }).where(eq(corrections.id, correctionId));
}

// ---------- workflows ----------

export async function saveWorkflow(opts: {
  name: string;
  workbookId?: number;
  scopeWorkbookIds?: number[] | null;
  definition: any;
}) {
  const [w] = await db.insert(workflows).values({
    name: opts.name,
    workbookId: opts.workbookId,
    scopeWorkbookIds: opts.scopeWorkbookIds ?? null,
    definition: opts.definition,
    isActive: true,
  }).returning();
  return w;
}

export async function findReusableWorkflow(workbookId: number) {
  const all = await db.select().from(workflows).where(eq(workflows.isActive, true));
  return all.find((w) => {
    if (w.workbookId === workbookId) return true;
    const scope = w.scopeWorkbookIds as number[] | null;
    return Array.isArray(scope) && scope.includes(workbookId);
  }) || null;
}

export async function listWorkflows() {
  return db.select().from(workflows).orderBy(desc(workflows.createdAt));
}

// ---------- job helpers ----------

export async function getJob(jobId: number) {
  return (await db.select().from(jobs).where(eq(jobs.id, jobId)).limit(1))[0] || null;
}

export async function listJobs(limit = 50) {
  return db.select().from(jobs).orderBy(desc(jobs.createdAt)).limit(limit);
}
