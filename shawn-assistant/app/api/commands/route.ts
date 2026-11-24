import { NextResponse } from 'next/server';
import { interpretCommand } from '@/lib/ai';
import { db } from '@/db';
import { jobs } from '@/db/schema';

export async function POST(req: Request) {
  try {
    const { command, workbookUrl } = await req.json();

    // 1. Interpret command using AI
    const aiResult = await interpretCommand(command, { workbookUrl });

    // 2. Log job (Assuming a default user or extracting from session)
    const [newJob] = await db.insert(jobs).values({
      workbookId: 1, // Placeholder
      command,
      status: 'pending',
      result: aiResult,
    }).returning();

    return NextResponse.json({ jobId: newJob.id, ...aiResult });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to process command' }, { status: 500 });
  }
}
