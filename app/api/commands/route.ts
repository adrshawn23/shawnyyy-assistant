import { NextResponse } from 'next/server';
import { interpretCommand } from '@/lib/ai';
import { db } from '@/db';
import { jobs } from '@/db/schema';

export async function POST(req: Request) {
  const { command, workbookUrl } = await req.json();

  // 1. Interpret command
  const aiResult = await interpretCommand(command, { workbookUrl });

  // 2. Log job
  const [newJob] = await db.insert(jobs).values({
    workbookId: 1, // Need to lookup workbookId from URL
    command,
    status: 'pending',
    result: aiResult,
  }).returning();

  return NextResponse.json({ jobId: newJob.id, ...aiResult });
}
