// Conversation memory: persists every exchange and mines chats for durable
// learnings (preferences, facts, workflows) stored as rules — Shawn's
// progressive knowledge.

import { db } from "@/db";
import { chatMessages, rules } from "@/db/schema";
import { desc, gt, and, eq, sql } from "drizzle-orm";
import { chatReply } from "./llm";

const AUTO_LEARN_EVERY = 20; // messages
let learning = false;

// Automatically mine chats for learnings once enough new messages accumulate.
// Fire-and-forget — never blocks the user's request.
export async function maybeAutoLearn() {
  if (learning) return;
  try {
    // Find when we last learned (latest memory rule), count messages since.
    const memRules = await db.select().from(rules).where(eq(rules.type, "memory"));
    const lastLearn = memRules.length
      ? new Date(Math.max(...memRules.map((r) => new Date(r.createdAt as any).getTime())))
      : new Date(0);
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(chatMessages)
      .where(gt(chatMessages.createdAt, lastLearn));
    if (count < AUTO_LEARN_EVERY) return;
    learning = true;
    learnFromChats({ sinceDays: 30, maxMessages: 300 })
      .then((r) => console.log(`[memory] auto-learn: ${r.message}`))
      .catch((e) => console.error("[memory] auto-learn failed", e))
      .finally(() => { learning = false; });
  } catch { /* best-effort */ }
}

export async function logMessage(email: string | null, role: "user" | "assistant", content: string, kind?: string) {
  try {
    await db.insert(chatMessages).values({ email, role, content: content.slice(0, 8000), kind });
  } catch { /* memory is best-effort */ }
}

export async function recentMessages(limit = 20) {
  return db.select().from(chatMessages).orderBy(desc(chatMessages.id)).limit(limit);
}

// Memory rules learned from past conversations (type "memory").
export async function memoryContext(): Promise<string> {
  const mem = await db.select().from(rules).where(eq(rules.type, "memory"));
  const active = mem.filter((r) => r.status === "active");
  if (!active.length) return "";
  return active.map((r) => `- ${(r.definition as any)?.fact || r.name}`).join("\n");
}

// Mine recent conversations for durable facts/preferences and store them as
// memory rules. Called on demand ("learn from our chats") or periodically.
export async function learnFromChats(opts: { sinceDays?: number; maxMessages?: number } = {}) {
  const since = new Date(Date.now() - (opts.sinceDays ?? 30) * 86400000);
  const msgs = await db
    .select()
    .from(chatMessages)
    .where(gt(chatMessages.createdAt, since))
    .orderBy(desc(chatMessages.id))
    .limit(opts.maxMessages ?? 200);

  if (msgs.length < 4) {
    return { learned: 0, message: "Not enough conversation history yet." };
  }

  const transcript = msgs.reverse().map((m) => `${m.role === "user" ? "User" : "Shawn"}: ${m.content}`).join("\n");

  const prompt = `You are analyzing chat transcripts between a user and their AI assistant "Shawn" (a logistics/sheets automation assistant).
Extract ONLY durable, reusable knowledge worth remembering long-term:
- User preferences (language, tone, formats they like)
- Facts about their work, hubs, processes, KPIs
- Recurring workflows or commands they use
- Corrections or things Shawn got wrong that should be remembered

Do NOT extract one-off questions, greetings, or transient details.

Return a JSON array of objects: [{"fact": "short durable fact", "category": "preference|fact|workflow|correction"}]
Return [] if nothing durable. Transcript:\n\n${transcript.slice(0, 12000)}`;

  const raw = await chatReply(prompt, [], undefined);
  if (!raw) return { learned: 0, message: "LLM unavailable — try again later." };

  // Parse JSON array from the reply (tolerate markdown fences).
  const jsonMatch = raw.match(/\[[\s\S]*\]/);
  if (!jsonMatch) return { learned: 0, message: "No learnings extracted." };

  let items: { fact: string; category?: string }[] = [];
  try {
    items = JSON.parse(jsonMatch[0]);
  } catch {
    return { learned: 0, message: "Could not parse learnings." };
  }

  let learned = 0;
  for (const item of items.slice(0, 20)) {
    if (!item.fact || item.fact.length < 10) continue;
    // Deduplicate: skip if an identical fact already exists.
    const existing = await db.select().from(rules).where(and(eq(rules.type, "memory"), eq(rules.status, "active")));
    const dup = existing.some((r) => String((r.definition as any)?.fact || "").toLowerCase() === item.fact.toLowerCase());
    if (dup) continue;
    await db.insert(rules).values({
      workbookId: null,
      type: "memory",
      name: `Memory: ${item.fact.slice(0, 80)}`,
      definition: { fact: item.fact, category: item.category || "fact", source: "chat" },
      status: "active",
    });
    learned++;
  }

  return { learned, message: `Learned ${learned} new thing${learned === 1 ? "" : "s"} from your chats.` };
}
