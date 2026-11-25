// Access request drafting + verification.
// Owners grant Shawn access directly. Shawn asks for Viewer on source
// workbooks and Editor on separate reporting workbooks.

import { db } from "@/db";
import { accessRequests, verifications, workbooks } from "@/db/schema";
import { eq } from "drizzle-orm";
import { extractSpreadsheetId, verifyViewerAccess, verifyEditorAccess, serviceAccountEmail } from "@/lib/google";
import { env, isDemo } from "@/lib/env";

export function buildDraft(opts: {
  workbookUrl: string;
  ownerEmail: string;
  reason: string;
  role: "viewer" | "editor";
}): string {
  const sa = serviceAccountEmail();
  const roleText =
    opts.role === "viewer"
      ? "Viewer (read-only) — Shawn only reads this source workbook."
      : "Editor — Shawn writes reports ONLY to this separate reporting workbook.";
  return [
    `Subject: Shawn access request — ${opts.workbookUrl}`,
    ``,
    `Hi ${opts.ownerEmail},`,
    ``,
    `Shawn (our internal AI work assistant) needs access to a workbook for: ${opts.reason}`,
    ``,
    `Please share this workbook with Shawn's service account:`,
    `  ${sa}`,
    `  Role: ${roleText}`,
    ``,
    `Workbook: ${opts.workbookUrl}`,
    ``,
    `Shawn will never modify source workbooks — writes go only to approved reporting workbooks.`,
    `You can revoke access anytime by removing ${sa} from the sharing list.`,
    ``,
    `Thanks!`,
    `— Shawn`,
  ].join("\n");
}

export async function createAccessRequest(input: {
  workbookUrl: string;
  ownerEmail: string;
  reason: string;
  role?: "viewer" | "editor";
  requesterEmail?: string;
}) {
  const spreadsheetId = extractSpreadsheetId(input.workbookUrl);
  if (!spreadsheetId && !isDemo()) {
    throw new Error("Invalid Google Sheets URL");
  }
  const role = input.role || "viewer";

  // Reuse existing workbook row if present.
  let wb = spreadsheetId
    ? (await db.select().from(workbooks).where(eq(workbooks.spreadsheetId, spreadsheetId)).limit(1))[0]
    : undefined;
  if (!wb) {
    [wb] = await db
      .insert(workbooks)
      .values({
        spreadsheetId: spreadsheetId || `demo-${Date.now()}`,
        url: input.workbookUrl,
        ownerEmail: input.ownerEmail,
        name: input.workbookUrl.includes("demo") ? "Demo workbook" : null,
        isDemo: isDemo(),
      })
      .returning();
  }

  const draftText = buildDraft({ ...input, role });
  const [req] = await db
    .insert(accessRequests)
    .values({
      workbookId: wb.id,
      requesterEmail: input.requesterEmail,
      ownerEmail: input.ownerEmail,
      reason: input.reason,
      requestedRole: role,
      status: "pending",
      draftText,
    })
    .returning();
  return { request: req, workbook: wb, draftText };
}

// Verify actual access under Shawn's credentials. Re-run before every use.
export async function verifyAccess(workbookId: number) {
  const wb = (await db.select().from(workbooks).where(eq(workbooks.id, workbookId)).limit(1))[0];
  if (!wb) throw new Error("Workbook not found");
  const spreadsheetId = wb.spreadsheetId || extractSpreadsheetId(wb.url);
  if (!spreadsheetId) throw new Error("No spreadsheet id");

  const viewer = await verifyViewerAccess(spreadsheetId);
  await db.insert(verifications).values({
    workbookId, kind: "viewer", result: viewer.result, detail: viewer.detail,
  });

  let editor: Awaited<ReturnType<typeof verifyEditorAccess>> | null = null;
  if (viewer.result === "success") {
    editor = await verifyEditorAccess(spreadsheetId);
    await db.insert(verifications).values({
      workbookId, kind: "editor", result: editor.result, detail: editor.detail,
    });
  }

  const reqs = await db.select().from(accessRequests).where(eq(accessRequests.workbookId, workbookId));
  for (const r of reqs) {
    if (r.status === "revoked") continue;
    const needed = r.requestedRole === "editor" ? "editor" : "viewer";
    const check = needed === "editor" ? editor : viewer;
    if (!check) continue;
    const ok = check.result === "success";
    await db
      .update(accessRequests)
      .set({
        status: ok ? "verified" : check.result === "denied" ? "pending" : "pending",
        verification: { viewer, editor, checkedAt: new Date().toISOString() },
        updatedAt: new Date(),
      })
      .where(eq(accessRequests.id, r.id));
  }

  return { workbook: wb, viewer, editor };
}

export async function revokeAccess(requestId: number) {
  await db
    .update(accessRequests)
    .set({ status: "revoked", updatedAt: new Date() })
    .where(eq(accessRequests.id, requestId));
}

export { env };

// Demo mode: auto-create verified access requests so the pipeline runs
// end-to-end without Google credentials.
export async function seedDemoAccess() {
  if (!isDemo()) return;
  const { demoSpreadsheetIds } = await import("@/lib/demo-data");
  const ids = demoSpreadsheetIds();
  const names: Record<string, string> = {
    "demo-hub-raw": "DEMO — Hub Raw Data",
    "demo-hub-report": "DEMO — Hub Report (Reporting)",
    "demo-daily-entry": "DEMO — Daily Entry Log",
  };
  for (const sid of ids) {
    let wb = (await db.select().from(workbooks).where(eq(workbooks.spreadsheetId, sid)).limit(1))[0];
    if (!wb) {
      [wb] = await db.insert(workbooks).values({
        spreadsheetId: sid,
        url: `demo://${sid}`,
        name: names[sid] || sid,
        ownerEmail: "demo@company.local",
        isDemo: true,
      }).returning();
    }
    if (!wb) continue;
    const role = sid === "demo-hub-report" ? "editor" : "viewer";
    const existing = await db.select().from(accessRequests).where(eq(accessRequests.workbookId, wb.id));
    if (existing.length === 0) {
      await db.insert(accessRequests).values({
        workbookId: wb.id,
        ownerEmail: "owner@company.com",
        reason: "Demo seed",
        requestedRole: role,
        status: "verified",
        verification: { viewer: { result: "success", detail: "demo" }, editor: role === "editor" ? { result: "success", detail: "demo" } : null },
      });
    }
    // Seed approved cleaning rule for the demo source workbook.
    if (sid === "demo-hub-raw") {
      const { rules } = await import("@/db/schema");
      const existingRules = await db.select().from(rules).where(eq(rules.workbookId, wb.id));
      if (existingRules.length === 0) {
        await db.insert(rules).values({
          workbookId: wb.id,
          type: "cleaning",
          name: "Demo hub/status canonicalization",
          status: "active",
          definition: {
            canonicalHubs: ["Cebu Hub", "Davao Hub", "Manila Hub"],
            hubAliases: {
              "cebu hub": "Cebu Hub", "cebu": "Cebu Hub", "cebuhub": "Cebu Hub",
              "davao hub": "Davao Hub", "davao": "Davao Hub",
              "manila hub": "Manila Hub", "manila": "Manila Hub", "mnl": "Manila Hub",
            },
            statusAliases: {
              "received": "Received", "in transit": "In Transit", "delivered": "Delivered",
              "exception": "Exception", "pending": "Pending",
            },
          },
        });
      }
    }
  }
}
