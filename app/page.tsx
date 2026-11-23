import { db } from "@/db";
import { jobs } from "@/db/schema";
import { desc } from "drizzle-orm";
import Link from "next/link";

export const dynamic = 'force-dynamic';

export default async function Dashboard() {
  const jobList = await db.select().from(jobs).orderBy(desc(jobs.createdAt)).limit(10);

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Shawn Command Center</h1>
      
      <nav className="mb-8 flex gap-4">
        <Link href="/access" className="text-blue-500 underline">Access Request Center</Link>
        <Link href="/data-review" className="text-blue-500 underline">Data Review</Link>
        <Link href="/rules" className="text-blue-500 underline">Rule Review</Link>
      </nav>

      <div className="mb-8">
        <h2 className="text-lg font-semibold">Recent Jobs</h2>
        <ul>
          {jobList.map((job) => (
            <li key={job.id} className="border-b py-2">
              {job.command} - <span className="font-mono text-sm">{job.status}</span>
            </li>
          ))}
        </ul>
      </div>
      <div>
        <h2 className="text-lg font-semibold">Quick Actions</h2>
        <button className="bg-blue-500 text-white p-2 rounded">
          Clean Data
        </button>
      </div>
    </div>
  );
}


