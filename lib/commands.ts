// Typed command interpreter. English + basic Bisaya/Cebuano keywords.
// Execution is always deterministic; this only classifies intent and extracts
// parameters. Ambiguity returns needs_input with a specific question.

export type CommandAction =
  | { type: "clean_sheet"; workbookUrl?: string; tab?: string }
  | { type: "hub_report"; workbookUrl?: string; tab?: string; period?: { start: string; end: string }; reportingUrl?: string }
  | { type: "build_dashboard"; workbookUrl?: string }
  | { type: "latest_match"; tab?: string; keyColumn?: string; returnColumn?: string; orderedBy?: "append" | "timestamp" }
  | { type: "nth_match"; tab?: string; n?: number }
  | { type: "formula"; raw: string }
  | { type: "job_status"; jobId?: number }
  | { type: "remember_workflow" }
  | { type: "same_as_last_time" }
  | { type: "correct"; correction: string }
  | { type: "unknown"; raw: string };

const CLEAN_RE = /(clean|linis|limpyo|hugas|i-?clean)/i;
const REPORT_RE = /(hub report|report|dashboard|buhat.*report|tubag)/i;
const LATEST_RE = /(latest|last|pinakabag-o|last match|most recent)/i;
const NTH_RE = /(second|2nd|third|3rd|\d+(st|nd|rd|th))/i;
const FORMULA_RE = /(formula|pormula|mag-?generate)/i;
const STATUS_RE = /(job status|status|unsa na|progress)/i;
const REMEMBER_RE = /(remember|hinumdomi|sulod|i-?save)/i;
const SAME_RE = /(same as last|pareho|same process|last time)/i;
const CORRECT_RE = /(instead|dapat|seharusnya|correct|fix|ayaw|himuon)/i;

export function parseCommand(raw: string): CommandAction {
  const cmd = raw.trim();
  const lower = cmd.toLowerCase();

  if (REMEMBER_RE.test(cmd) && /process|workflow|procedure|steps/i.test(cmd)) {
    return { type: "remember_workflow" };
  }
  if (SAME_RE.test(cmd)) return { type: "same_as_last_time" };
  if (STATUS_RE.test(cmd) && /job|status|progress/i.test(cmd)) {
    const m = cmd.match(/#?(\d+)/);
    return { type: "job_status", jobId: m ? parseInt(m[1]) : undefined };
  }
  if (CORRECT_RE.test(cmd)) return { type: "correct", correction: cmd };
  if (LATEST_RE.test(cmd) && (FORMULA_RE.test(cmd) || /match|lookup|find/i.test(cmd))) {
    const orderedBy = /date|timestamp|out.of.order/i.test(cmd) ? "timestamp" : "append";
    return { type: "latest_match", orderedBy };
  }
  if (NTH_RE.test(cmd) && /match|occurrence|second|find/i.test(cmd)) {
    const m = cmd.match(/(\d+)(st|nd|rd|th)/i);
    return { type: "nth_match", n: m ? parseInt(m[1]) : 2 };
  }
  if (FORMULA_RE.test(cmd)) return { type: "formula", raw: cmd };
  if (REPORT_RE.test(cmd) && (CLEAN_RE.test(cmd) || /report|dashboard/i.test(cmd))) {
    return { type: "hub_report", workbookUrl: extractUrl(cmd) };
  }
  if (CLEAN_RE.test(cmd)) return { type: "clean_sheet", workbookUrl: extractUrl(cmd) };
  if (/dashboard/i.test(cmd)) return { type: "build_dashboard", workbookUrl: extractUrl(cmd) };

  return { type: "unknown", raw: cmd };
}

function extractUrl(cmd: string): string | undefined {
  const m = cmd.match(/https?:\/\/[^\s]+/);
  return m ? m[0] : undefined;
}

// Period parsing: "this week", "last week", explicit dates.
export function parsePeriod(cmd: string, now = new Date()): { start: string; end: string } | null {
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  if (/this week/i.test(cmd)) {
    const day = now.getUTCDay(); // 0=Sun
    const monday = new Date(now);
    monday.setUTCDate(now.getUTCDate() - ((day + 6) % 7));
    const sunday = new Date(monday);
    sunday.setUTCDate(monday.getUTCDate() + 6);
    return { start: iso(monday), end: iso(sunday) };
  }
  if (/last week/i.test(cmd)) {
    const day = now.getUTCDay();
    const monday = new Date(now);
    monday.setUTCDate(now.getUTCDate() - ((day + 6) % 7) - 7);
    const sunday = new Date(monday);
    sunday.setUTCDate(monday.getUTCDate() + 6);
    return { start: iso(monday), end: iso(sunday) };
  }
  const range = cmd.match(/(\d{4}-\d{2}-\d{2})\s*(?:to|until|-)\s*(\d{4}-\d{2}-\d{2})/i);
  if (range) return { start: range[1], end: range[2] };
  return null;
}
