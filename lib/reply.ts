// Turns structured command results into natural-language replies so Shawn
// communicates like a chat assistant, not a raw API.

export function describeResult(data: any): string {
  if (!data || typeof data !== "object") return String(data ?? "");

  if (data.type === "chat") return data.reply || "";
  if (data.error) return `Sorry, something went wrong: ${data.error}`;

  switch (data.type) {
    case "hub_report":
    case "clean_sheet":
    case "build_dashboard":
    case "same_as_last_time": {
      if (data.status === "needs_input") return data.message || "Which workbook should I use?";
      if (data.status === "failed") return `That job failed: ${data.error || "unknown error"}. Check the Data Review page for details.`;
      if (data.status === "completed" && data.result) {
        const k = data.result.kpi?.totals;
        const s = data.result.stats;
        const recon = data.reconciliation?.ok ? "reconciliation passed" : "reconciliation FAILED — I did not publish";
        const write = data.result.write?.skipped ? "(clean-only, nothing published)" : `published to ${data.result.write?.workbook || "the reporting sheet"}`;
        let msg = `Done — job #${data.jobId}. ${k?.events ?? "?"} events across ${k?.shipments ?? "?"} shipments, ${s?.flaggedRows ?? 0} rows flagged for review. ${recon}; ${write}.`;
        if (data.cached) msg += " (This was already done — showing the saved result.)";
        if (data.result.exceptions?.length) {
          msg += `\n\nTop exceptions: ${data.result.exceptions.slice(0, 3).map((e: any) => `row ${e.row} (${e.id || "?"}: ${e.flags?.join(", ") || "issue"})`).join("; ")}.`;
        }
        return msg;
      }
      return data.message || `Job #${data.jobId} is ${data.status}.`;
    }

    case "formula": {
      const f = data.formulas?.[0];
      if (!f) return "I couldn't build a formula for that.";
      const steps = (f.steps || []).map((s: any) => `${s.pasteCell}: ${s.formula}`).join("\n");
      return `${f.description || "Here's the formula:"}\n\n${steps}`;
    }

    case "job_status": {
      const st = data.status;
      if (Array.isArray(st)) {
        if (!st.length) return "No jobs yet — give me a command to get started.";
        return st.slice(0, 8).map((j: any) => `• #${j.id} ${j.type} — ${j.status}${j.error ? ` (${j.error})` : ""}`).join("\n");
      }
      if (st?.error) return st.error;
      return `Job #${st?.id}: ${st?.status}${st?.error ? ` — ${st.error}` : ""}`;
    }

    case "remember_workflow": {
      if (data.error) return data.error;
      return data.message || "Workflow saved.";
    }

    case "correct": {
      return data.message || "Correction recorded.";
      }

    default:
      return data.message || "Got it.";
  }
}
