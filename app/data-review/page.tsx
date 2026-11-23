import { db } from "@/db";
import { jobs } from "@/db/schema";
import { desc } from "drizzle-orm";

export const dynamic = 'force-dynamic';

export default async function DataReview() {
  // Fetch only cleaning jobs for review
  const cleaningJobs = await db.select().from(jobs)
    .orderBy(desc(jobs.createdAt))
    .limit(20);

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Data Review</h1>
      <p className="mb-4">Review cleaned data and exceptions.</p>
      
      <table className="w-full text-left">
        <thead>
          <tr>
            <th>Job ID</th>
            <th>Status</th>
            <th>Created</th>
          </tr>
        </thead>
        <tbody>
          {cleaningJobs.map((job) => (
            <tr key={job.id} className="border-b">
              <td>{job.id}</td>
              <td>{job.status}</td>
              <td>{job.createdAt?.toLocaleDateString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}


