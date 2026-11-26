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
import { converse } from "@/lib/converse";
import { describeResult } from "@/lib/reply";
import { chatReply } from "@/lib/llm";
import { logMessage, memoryContext, learnFromChats } from "@/lib/memory";

export const dynamic = "force-dynamic";

function respond(data: any) {
  return NextResponse.json({ ...data, reply: describeResult(data) });
}

// Cached list of the user's recent Drive files, injected into LLM context so
// Shawn can answer questions about their files naturally.
let driveContextCache: { at: number; text: string } | null = null;
async function driveContext(): Promise<string> {
  if (driveContextCache && Date.now() - driveContextCache.at < 5 * 60 * 1000) return driveContextCache.text;
  try {
    const { listDriveFiles } = await import("@/services/drive");
    const { files } = await listDriveFiles({ pageSize: 30 });
    const text = files.length
      ? files.map((f) => `- ${f.name} (${f.mimeType.includes("spreadsheet") ? "Google Sheet" : f.mimeType.includes("document") ? "Google Doc" : "file"})`).join("\n")
      : "";
    driveContextCache = { at: Date.now(), text };
    return text;
  } catch {
    return "";
  }
}

export async function POST(req: Request) {
  try {
    const email = await getSessionEmail();
    if (!email) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

    const { command, workbookUrl, tab, history } = await req.json();
    const chatHistory = Array.isArray(history) ? history : [];
    if (!command || typeof command !== "string") {
      return NextResponse.json({ error: "command is required" }, { status: 400 });
    }
    await logMessage(email, "user", command, "command");

    // "learn from our chats" — mine conversation history for durable knowledge.
    if (/learn from (our|the|my) chats?|memorize/i.test(command)) {
      const res = await learnFromChats();
      return respond({ type: "learn_chats", ...res });
    }

    // Chat-style messages (greetings, help, thanks) are handled conversationally.
    // OmniRoute LLM gets first crack for a natural reply; deterministic fallback.
    const chat = converse(command);
    if (chat) {
      const [ctx, mem] = await Promise.all([driveContext(), memoryContext()]);
      const llm = await chatReply(command, chatHistory, [ctx, mem].filter(Boolean).join("\n"));
      const reply = llm || chat;
      await logMessage(email, "user", command, "chat");
      await logMessage(email, "assistant", reply, "chat");
      return respond({ type: "chat", reply });
    }

    const action = parseCommand(command);

    switch (action.type) {
      case "hub_report":
      case "clean_sheet": {
        const period = parsePeriod(command);
        const urls = command.match(/https?:\/\/[^\s]+/g) || [];
        const res = await runHubReport({
          command,
          workbookUrl: action.workbookUrl || workbookUrl || urls[0],
          reportingUrl: urls[1] || undefined,
          tab,
          period: period || undefined,
          skipWrite: action.type === "clean_sheet",
        });
        return respond(res);
      }

      case "build_dashboard": {
        const res = await runHubReport({
          command, workbookUrl: action.workbookUrl || workbookUrl, tab,
          period: parsePeriod(command) || undefined,
        });
        return respond(res);
      }

      case "latest_match":
      case "nth_match":
      case "formula": {
        const formulas = await buildFormulas(command, action);
        // "apply/write/set ... formula" → actually write formulas into the sheet.
        if (/\b(apply|write|set|put|insert)\b/i.test(command) && !isDemo()) {
          const urlMatch = command.match(/https?:\/\/[^\s]+/);
          const sid = urlMatch ? extractSpreadsheetId(urlMatch[0]) : null;
          if (sid) {
            const backend = await getBackend();
            const written: string[] = [];
            for (const f of formulas) {
              for (const step of f.steps || []) {
                if (step.formula && step.pasteCell) {
                  await backend.writeValues(sid, `Daily Entry!${step.pasteCell}`, [[step.formula]]);
                  written.push(`${step.pasteCell}: ${step.formula.slice(0, 60)}…`);
                }
              }
            }
            return respond({ type: "formula_applied", formulas, written, message: `Applied ${written.length} formula(s) to the sheet.` });
          }
        }
        return respond({ type: "formula", formulas });
      }

      case "drive_files": {
        try {
          const { listDriveFiles } = await import("@/services/drive");
          const { files } = await listDriveFiles({ query: action.query, pageSize: 15 });
          if (!files.length) {
            return respond({ type: "drive_files", files: [], message: "I don't see any files matching that on your Drive." });
          }
          return respond({
            type: "drive_files",
            files: files.map((f) => ({ name: f.name, type: f.mimeType, modified: f.modifiedTime })),
            message: files.length === 1
              ? `Here's one: "${files[0].name}"`
              : `Here are ${files.length} files: ${files.slice(0, 5).map((f) => `"${f.name}"`).join(", ")}${files.length > 5 ? "…" : ""}`,
          });
        } catch (e: any) {
          return respond({ type: "drive_files", error: e?.message || "Could not reach your Drive.", message: "I couldn't reach your Drive right now." });
        }
      }

      case "job_status": {
        const status = await jobStatus(action.jobId);
        return respond({ type: "job_status", status });
      }

      case "remember_workflow": {
        const last = (await db.select().from(jobs).orderBy(desc(jobs.createdAt)).limit(1))[0];
        if (!last || last.status !== "completed") {
          return respond({ type: "remember_workflow", error: "No completed job to save yet. Run a hub report first." });
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
        return respond({ type: "remember_workflow", workflow: wf, message: `Saved workflow "${wf.name}" (v${wf.version}). Say "same as last time" to reuse it.` });
      }

      case "same_as_last_time": {
        const src = await resolveWorkbook(workbookUrl);
        if (!src) return respond({ type: "same_as_last_time", error: "Which workbook? Provide the Sheet URL." });
        const wf = await findReusableWorkflow(src.id);
        if (!wf) return respond({ type: "same_as_last_time", error: "No saved workflow matches this workbook scope." });
        const def = wf.definition as any;
        const res = await runHubReport({
          command: `same as last time (workflow #${wf.id})`,
          workbookUrl,
          tab: def?.result?.sourceTab,
          period: def?.period || parsePeriod(command) || undefined,
        });
        return respond({ type: "same_as_last_time", workflow: wf, ...res });
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
        return respond({
          type: "correct",
          correction: corr,
          message: "Correction recorded. Review it under Rules to use once, approve for this workbook, or approve globally.",
        });
      }

      default: {
        // Unrecognized input: let the LLM answer conversationally if available.
        const [ctx, mem] = await Promise.all([driveContext(), memoryContext()]);
        const llm = await chatReply(command, chatHistory, [ctx, mem].filter(Boolean).join("\n"));
        if (llm) {
          await logMessage(email, "assistant", llm, "chat");
          return respond({ type: "chat", reply: llm });
        }
        return respond({
          type: "unknown",
          message: "Hmm, I didn't quite get that. Try \"clean this raw data and build this week's hub report\", \"show job status\", \"find latest matching entry\", or ask me \"what can you do\".",
        });
      }
    }
  } catch (e: any) {
    console.error("commands error", e);
    return NextResponse.json({ error: e?.message || "Internal error" }, { status: 500 });
  }
}

async function buildFormulas(command: string, action: any) {
  const urlMatch = command.match(/https?:\/\/[^\s]+/);
  let spreadsheetId = isDemo() ? "demo-daily-entry" : "";
  const tab = "Daily Entry";
  if (urlMatch) {
    const sid = extractSpreadsheetId(urlMatch[0]);
    if (sid) spreadsheetId = sid;
  }
  if (!spreadsheetId) {
    return [{ kind: "error", description: "Which sheet? Please paste the Google Sheets URL.", steps: [] }];
  }

  const backend = await getBackend();
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
