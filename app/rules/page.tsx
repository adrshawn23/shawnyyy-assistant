import { db } from "@/db";
import { rules } from "@/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = 'force-dynamic';

export default async function RuleReview() {
  const allRules = await db.select().from(rules);

  async function toggleRule(id: number, isActive: boolean) {
    'use server';
    await db.update(rules).set({ isActive: !isActive }).where(eq(rules.id, id));
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Rule Review & Version History</h1>
      <table className="w-full">
        <thead>
          <tr>
            <th className="text-left">Type</th>
            <th className="text-left">Version</th>
            <th className="text-left">Active</th>
            <th className="text-left">Action</th>
          </tr>
        </thead>
        <tbody>
          {allRules.map((rule) => (
            <tr key={rule.id}>
              <td>{rule.type}</td>
              <td>{rule.version}</td>
              <td>{rule.isActive ? "Yes" : "No"}</td>
              <td>
                <form action={toggleRule.bind(null, rule.id, rule.isActive!)}>
                  <button type="submit" className="text-sm text-blue-600 underline">
                    Toggle
                  </button>
                </form>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}


