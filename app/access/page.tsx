import { db } from "@/db";
import { accessRequests } from "@/db/schema";

export const dynamic = 'force-dynamic';

export default async function AccessRequestCenter() {
  const requests = await db.select().from(accessRequests);

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Access Request Center</h1>
      <table className="w-full">
        <thead>
          <tr>
            <th className="text-left">Workbook ID</th>
            <th className="text-left">Status</th>
            <th className="text-left">Reason</th>
          </tr>
        </thead>
        <tbody>
          {requests.map((req) => (
            <tr key={req.id}>
              <td>{req.workbookId}</td>
              <td>{req.status}</td>
              <td>{req.reason}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

