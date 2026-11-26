// Agent loop: Shawn acts like an agentic assistant (ChatGPT Work style).
// The LLM decides which tools to call, we execute them, feed results back,
// and iterate until it produces a final answer. Used for requests that don't
// match a deterministic command.

import { chatReply } from "./llm";
import { getBackend, extractSpreadsheetId } from "./google";
import { isDemo } from "./env";
import { runHubReport, resolveWorkbook, jobStatus } from "@/services/jobs";
import { listDriveFiles } from "@/services/drive";

const MAX_STEPS = 6;

const AGENT_PROMPT = `You are Shawn, an agentic AI assistant with tools to work on the user's Google Drive and Sheets.

You can call tools by replying with ONLY a JSON object (no markdown):
{"tool": "<name>", "args": {...}}

Available tools:
- {"tool":"list_files","args":{"query":"optional search text"}} — list/search Drive files
- {"tool":"read_sheet","args":{"url":"sheet URL or ID","range":"A1:Z200 optional, default first 200 rows"}} — read sheet contents
- {"tool":"sheet_info","args":{"url":"sheet URL or ID"}} — get title and tab names
- {"tool":"write_sheet","args":{"url":"sheet URL or ID","range":"A1","values":[["a","b"],["1","2"]]}} — write values to cells
- {"tool":"hub_report","args":{"url":"sheet URL","tab":"optional tab name","period":"optional e.g. this week"}} — clean data + build hub report
- {"tool":"job_status","args":{}} — check recent job status

When you have enough information or the task is done, reply with ONLY:
{"answer": "your final reply to the user"}

Rules:
- Chain tools as needed: e.g. list_files → read_sheet → analyze → answer.
- For analysis questions, read the sheet then summarize findings in "answer".
- For "build/make/create a dashboard/report", use hub_report or write_sheet.
- Keep answers concise. Mirror the user's language (English/Bisaya).
- If a tool fails, explain briefly in "answer" or try an alternative.`;

interface ToolResult { ok: boolean; data?: any; error?: string }

async function execTool(name: string, args: any): Promise<ToolResult> {
  try {
    switch (name) {
      case "list_files": {
        const { files } = await listDriveFiles({ query: args?.query, pageSize: 20 });
        return { ok: true, data: files.map((f) => ({ name: f.name, type: f.mimeType, modified: f.modifiedTime, url: f.webViewLink })) };
      }
      case "sheet_info": {
        const sid = extractSpreadsheetId(args?.url || "") || args?.url;
        if (!sid) return { ok: false, error: "No spreadsheet ID in url" };
        const meta = await (await getBackend()).getMeta(sid);
        return { ok: true, data: meta };
      }
      case "read_sheet": {
        const sid = extractSpreadsheetId(args?.url || "") || args?.url;
        if (!sid) return { ok: false, error: "No spreadsheet ID in url" };
        const range = args?.range || "A1:Z200";
        const rows = await (await getBackend()).readValues(sid, range);
        return { ok: true, data: { rows: rows.slice(0, 200), totalRows: rows.length } };
      }
      case "write_sheet": {
        const sid = extractSpreadsheetId(args?.url || "") || args?.url;
        if (!sid) return { ok: false, error: "No spreadsheet ID in url" };
        await (await getBackend()).writeValues(sid, args?.range || "A1", args?.values || []);
        return { ok: true, data: { written: `${args?.range || "A1"}` } };
      }
      case "hub_report": {
        const res = await runHubReport({
          command: "agent hub_report",
          workbookUrl: args?.url,
          tab: args?.tab,
          period: args?.period ? parsePeriodArg(args.period) : undefined,
        });
        return { ok: res.status !== "failed", data: res };
      }
      case "job_status": {
        return { ok: true, data: await jobStatus() };
      }
      default:
        return { ok: false, error: `Unknown tool: ${name}` };
    }
  } catch (e: any) {
    return { ok: false, error: e?.message || String(e) };
  }
}

function parsePeriodArg(p: string) {
  const now = new Date();
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  if (/last week/i.test(p)) {
    const day = now.getUTCDay();
    const monday = new Date(now);
    monday.setUTCDate(now.getUTCDate() - ((day + 6) % 7) - 7);
    const sunday = new Date(monday);
    sunday.setUTCDate(monday.getUTCDate() + 6);
    return { start: iso(monday), end: iso(sunday) };
  }
  const m = p.match(/(\d{4}-\d{2}-\d{2})\s*(?:to|until|-)?\s*(\d{4}-\d{2}-\d{2})?/);
  if (m) return { start: m[1], end: m[2] || m[1] };
  return undefined;
}

function parseJsonReply(text: string): any | null {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try { return JSON.parse(m[0]); } catch { return null; }
}

export interface AgentResult {
  reply: string;
  actions: string[]; // tool names invoked, for transparency
}

export async function agentRun(userMessage: string, extraContext?: string): Promise<AgentResult | null> {
  if (isDemo() && !process.env.OMNIROUTE_BASE_URL) return null;
  const messages: { role: string; content: string }[] = [
    { role: "user", content: userMessage },
  ];
  const actions: string[] = [];

  for (let step = 0; step < MAX_STEPS; step++) {
    const context = [AGENT_PROMPT, extraContext].filter(Boolean).join("\n\n");
    const last = messages[messages.length - 1];
    const raw = await chatReply(last.content, messages.slice(0, -1), context);
    if (!raw) return null;

    const parsed = parseJsonReply(raw);
    if (!parsed) {
      // LLM replied in plain text — treat as final answer.
      return { reply: raw, actions };
    }

    if (parsed.answer) {
      return { reply: String(parsed.answer), actions };
    }

    if (parsed.tool) {
      actions.push(parsed.tool);
      const result = await execTool(parsed.tool, parsed.args || {});
      const payload = JSON.stringify(result.ok ? result.data : { error: result.error }).slice(0, 12000);
      messages.push({ role: "assistant", content: raw });
      messages.push({ role: "user", content: `Tool result for ${parsed.tool}:\n${payload}` });
      continue;
    }

    return { reply: raw, actions };
  }

  return { reply: "I worked on it but ran out of steps — here's what I found so far. Try narrowing the request.", actions };
}
