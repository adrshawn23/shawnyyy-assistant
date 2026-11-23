import { NextResponse } from 'next/server';
import { db } from '@/db';
import { accessRequests, workbooks } from '@/db/schema';
import { extractSpreadsheetId } from '@/lib/google';

export async function POST(req: Request) {
  const { workbookUrl, ownerEmail, reason } = await req.json();

  const spreadsheetId = extractSpreadsheetId(workbookUrl);
  if (!spreadsheetId) {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
  }

  // 1. Create or get workbook
  const [newWorkbook] = await db.insert(workbooks).values({
    url: workbookUrl,
    ownerEmail,
    name: 'Pending name',
  }).returning();

  // 2. Create access request
  const [newRequest] = await db.insert(accessRequests).values({
    workbookId: newWorkbook.id,
    reason,
    status: 'pending',
  }).returning();

  return NextResponse.json({ requestId: newRequest.id, message: 'Request created' });
}
