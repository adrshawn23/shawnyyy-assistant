// Conversational AI via OmniRoute (OpenAI-compatible /chat/completions).
// Falls back to null when OmniRoute isn't configured or unreachable, so the
// deterministic replies in lib/converse.ts / lib/reply.ts always work.

import { env } from "./env";

const SYSTEM_PROMPT = `You are Shawn, a friendly internal AI work assistant for a logistics company.
You help staff with Google Sheets tasks: cleaning raw data, building hub reports,
checking KPIs, generating lookup formulas, and remembering workflows.

Rules:
- Reply conversationally and concisely (2-5 sentences), like a helpful chat assistant.
- You can speak English and Bisaya; mirror the user's language.
- You do NOT execute commands yourself — the system does that. If the user asks
  for an action, tell them the command to use or confirm what will happen.
- If asked what you can do, list your capabilities briefly.
- Never invent data or results. If you don't know, say so.`;

export function omniRouteEnabled(): boolean {
  return Boolean(env.omniRouteBaseUrl);
}

export async function chatReply(userMessage: string, history: { role: string; content: string }[] = [], context?: string): Promise<string | null> {
  if (!omniRouteEnabled()) return null;
  try {
    const base = env.omniRouteBaseUrl.replace(/\/$/, "");
    const res = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(env.omniRouteApiKey ? { Authorization: `Bearer ${env.omniRouteApiKey}` } : {}),
      },
      body: JSON.stringify({
        model: env.omniRouteModel || undefined,
        messages: [
          { role: "system", content: SYSTEM_PROMPT + (context ? `\n\nContext about the user's files:\n${context}` : "") },
          ...history.slice(-10),
          { role: "user", content: userMessage },
        ],
        temperature: 0.7,
        max_tokens: 500,
      }),
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) return null;
    const data: any = await res.json();
    const text = data?.choices?.[0]?.message?.content;
    return typeof text === "string" && text.trim() ? text.trim() : null;
  } catch {
    return null;
  }
}
