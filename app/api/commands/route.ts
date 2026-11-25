import { NextResponse } from 'next/server';
import { interpretCommand } from '@/lib/ai';
import { db } from '@/db';
import { jobs } from '@/db/schema';
import { fetchSheetData } from '@/services/sheets-service';
import { cleanData } from '@/services/data-processing';

export async function POST(req: Request) {
  try {
    const { command, workbookUrl } = await req.json();

    // 1. Interpret command
    const aiResult = await interpretCommand(command, { workbookUrl });

    // 2. Perform action based on intent
    if (aiResult.intent === 'clean_data') {
      try {
        const rawData = await fetchSheetData(workbookUrl, 'Sheet1!A:D');
        if (rawData) {
          cleanData(rawData);
          // Logic for writing back to Sheet would go here
        }
      } catch (sheetError) {
        console.error("Sheet API error:", sheetError);
        // Continue, just log the error
      }
    }

    // 3. Log job
    try {
      const [newJob] = await db.insert(jobs).values({
        workbookId: 1, // Simplified
        command,
        status: 'completed',
        result: aiResult,
      }).returning();
      return NextResponse.json({ jobId: newJob.id, ...aiResult });
    } catch (dbError) {
      console.error("Database insert error:", dbError);
      return NextResponse.json({ error: 'Database failed', details: dbError }, { status: 500 });
    }
  } catch (error) {
    console.error("Command API error:", error);
    return NextResponse.json({ error: 'Internal Server Error', details: error }, { status: 500 });
  }
}


