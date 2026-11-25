import { NextResponse } from "next/server";
import { parseCommand, parsePeriod } from "@/lib/commands";
import { runHubReport, jobStatus, resolveWorkbook } from "@/services/jobs";
import { getBackend, extractSpreadsheetId } from "@/lib/google";
import { isDemo } from "@/lib/env";
import {
  latestMatchAppend, latestMatchTimestamp, nthMatch, columnFill,
  type FormulaSpec,
} from "@/services/formulas";
import { saveWorkflow, findReusableWorkflow, recordCorrection } from "@/services/learning";
import { db } from "@/db";
import { jobs } from "@/db/schema";
import { desc } from "drizzle-orm";
import { getSessionEmail } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const email = await getSessionEmail();
    if (!email) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

    const { command, workbookUrl, tab } = await req.json();
    if (!command || typeof command !== "string") {
      return NextResponse.json({ error: "command is required" }, { status: 400 });
    }

    const action = parseCommand(command);

    switch (action.type) {
      case "hub_report":
      case "clean_sheet": {
        const period = parsePeriod(command);
        const res = await runHubReport({
          command,
          workbookUrl: action.workbookUrl || workbookUrl,
          tab,
          period: period || undefined,
          skipWrite: action.type === "clean_sheet",
        });
        return NextResponse.json(res);
      }

      case "build_dashboard": {
        const res = await runHubReport({
          command, workbookUrl: action.workbookUrl || workbookUrl, tab,
          period: parsePeriod(command) || undefined,
        });
        return NextResponse.json(res);
      }

      case "latest_match":
      case "nth_match":
      case "formula": {
        const formulas = await buildFormulas(command, action);
        return NextResponse.json({ type: "formula", formulas });
      }

      case "job_status": {
        const status = await jobStatus(action.jobId);
        return NextResponse.json({ type: "job_status", status });
      }

      case "remember_workflow": {
        const last = (await db.select().from(jobs).orderBy(desc(jobs.createdAt)).limit(1))[0];
        if (!last || last.status !== "completed") {
          return NextResponse.json({ type: "remember_workflow", error: "No completed job to save yet. Run a hub report first." });
        }
        const wf = await saveWorkflow({
          name: `Workflow from job #${last.id}`,
          workbookId: last.workbookId || undefined,
          definition: {
            sourceJobId: last.id,
            type: last.type,
            command: last.command,
            period: last.periodStart ? { start: last.periodStart, end: last.periodEnd } : null,
            result: last.result,
          },
        });
        return NextResponse.json({ type: "remember_workflow", workflow: wf, message: `Saved workflow "${wf.name}" (v${wf.version}). Say "same as last time" to reuse it.` });
      }

      case "same_as_last_time": {
        const src = await resolveWorkbook(workbookUrl);
        if (!src) return NextResponse.json({ type: "same_as_last_time", error: "Which workbook? Provide the Sheet URL." });
        const wf = await findReusableWorkflow(src.id);
        if (!wf) return NextResponse.json({ type: "same_as_last_time", error: "No saved workflow matches this workbook scope." });
        const def = wf.definition as any;
        const res = await runHubReport({
          command: `same as last time (workflow #${wf.id})`,
          workbookUrl,
          tab: def?.result?.sourceTab,
          period: def?.period || parsePeriod(command) || undefined,
        });
        return NextResponse.json({ type: "same_as_last_time", workflow: wf, ...res });
      }

      case "correct": {
        const lastJob = (await db.select().from(jobs).orderBy(desc(jobs.createdAt)).limit(1))[0];
        const corr = await recordCorrection({
          jobId: lastJob?.id,
          workbookId: lastJob?.workbookId || undefined,
          kind: "formula",
          previous: { note: "current behavior", command },
          proposed: { correction: action.correction },
        });
        return NextResponse.json({
          type: "correct",
          correction: corr,
          message: "Correction recorded. Review it under Rules to use once, approve for this workbook, or approve globally.",
        });
      }

      default:
        return NextResponse.json({
          type: "unknown",
          message: "I didn't understand that. Try: 'clean this raw data and build this week's hub report', 'show job status', 'find latest matching entry', or 'Shawn, remember this process'.",
        });
    }
  } catch (e: any) {
    console.error("commands error", e);
    return NextResponse.json({ error: e?.message || "Internal error" }, { status: 500 });
  }
}

async function buildFormulas(command: string, action: any) {
  const urlMatch = command.match(/https?:\/\/[^\s]+/);
  let spreadsheetId = "demo-daily-entry";
  const tab = "Daily Entry";
  if (urlMatch) {
    const sid = extractSpreadsheetId(urlMatch[0]);
    if (sid) spreadsheetId = sid;
  }

  const backend = getBackend();
  let headers: string[] = [];
  try {
    const grid = await backend.readValues(spreadsheetId, `${tab}!A1:Z200`);
    headers = (grid[0] || []).map((h) => String(h));
  } catch {
    headers = ["Entry", "Timestamp", "Hub", "Status", "Tracking ID"];
  }

  const col = (names: string[]) => {
    const idx = headers.findIndex((h) => names.some((n) => h.toLowerCase().includes(n)));
    return idx >= 0 ? String.fromCharCode(65 + idx) : "A";
  };
  const keyColumn = col(["tracking", "id", "key"]);
  const returnColumn = col(["status", "hub"]);
  const timestampColumn = col(["timestamp", "time", "date"]);
  const tiebreakColumn = col(["entry", "row", "#"]);

  const base: FormulaSpec = {
    kind: "latest_match",
    tab,
    keyColumn,
    returnColumn,
    keyCell: "E2",
    pasteCell: "H2",
    orderedBy: action.orderedBy || "append",
    timestampColumn,
    tieBreakerColumn: tiebreakColumn,
  };

  const out: any[] = [];
  if (action.type === "latest_match" && action.orderedBy === "timestamp") {
    const f = latestMatchTimestamp(base);
    out.push({
      kind: "latest_match_timestamp",
      description: "Latest match by approved timestamp (out-of-order log). Tie-break: last sheet row among max-timestamp matches.",
      steps: [
        { pasteCell: f.pasteHelperCell, formula: f.helper, note: "Helper: max timestamp for the key" },
        { pasteCell: f.pasteResultCell, formula: f.result, note: "Result: value at that timestamp" },
      ],
    });
  } else if (action.type === "latest_match") {
    out.push({
      kind: "latest_match_append",
      description: "Latest match — last matching row (append-ordered log). Blank/missing key returns empty.",
      steps: [{ pasteCell: base.pasteCell, formula: latestMatchAppend(base), note: "Paste in result cell; put lookup key in E2" }],
    });
  } else if (action.type === "nth_match") {
    const spec = { ...base, kind: "nth_match" as const, nth: action.n || 2 };
    out.push({
      kind: "nth_match",
      description: `${action.n || 2}${ordinal(action.n || 2)} occurrence of the key.`,
      steps: [{ pasteCell: base.pasteCell, formula: nthMatch(spec), note: "Array formula — modern Sheets handles it automatically." }],
    });
  } else {
    out.push({
      kind: "column_fill",
      description: "Column-filling formula for the whole column.",
      steps: [{ pasteCell: `${returnColumn}2`, formula: columnFill({ tab, formula: latestMatchAppend(base).replace(/^=/, ""), targetColumn: returnColumn }), note: "Paste once at top of column" }],
    });
  }
  return out;
}

function ordinal(n: number) {
  return n === 1 ? "st" : n === 2 ? "nd" : n === 3 ? "rd" : "th";
}
