import { db } from '@/db';
import { rules } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

export async function saveRule(workbookId: number, type: string, definition: any) {
  return await db.insert(rules).values({
    workbookId,
    type,
    definition,
  }).returning();
}

export async function updateRule(ruleId: number, definition: any) {
  return await db.update(rules)
    .set({ definition, version: 0 }) // Simplified versioning
    .where(eq(rules.id, ruleId))
    .returning();
}
