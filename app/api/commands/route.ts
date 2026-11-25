import { NextResponse } from 'next/server';
import { interpretCommand } from '@/lib/ai';
import { db } from '@/db';
import { jobs } from '@/db/schema';
import { fetchSheetData } from '@/services/sheets-service';
import { cleanData } from '@/services/data-processing';
import { extractSpreadsheetId } from '@/lib/google';
import { getServerSession } from "next-auth"; // Ensure correct import

export async function POST(req: Request) {
  try {
    const session = await getServerSession();
    const { command, workbookUrl } = await req.json();

    // 1. Interpret command
    const aiResult = await interpretCommand(command, { workbookUrl });

    let workbookId = null;
    if (workbookUrl) {
      // Robust URL extraction
      const id = extractSpreadsheetId(workbookUrl);
      if (id) {
        // In a real app, you would look up the ID in your 'workbooks' table here
      }
    }

    // 2. Perform action based on intent
    if (aiResult.intent === 'clean_data' && workbookUrl && session) {
      try {
        const accessToken = (session as any)?.accessToken;
        if (accessToken) {
            const rawData = await fetchSheetData(workbookUrl, 'Sheet1!A:D', accessToken);
            if (rawData) {
              cleanData(rawData);
            }
        }
      } catch (sheetError) {
        console.error("Sheet API error:", sheetError);
      }
    }

    // 3. Log job
    const jobData: any = {
      command,
      status: 'completed',
      result: aiResult,
    };
    
    // Only add workbookId if it was successfully extracted and exists
    if (workbookId) {
      jobData.workbookId = workbookId;
    }

    await db.insert(jobs).values(jobData);

    return NextResponse.json({ jobId: 'success', ...aiResult });
  } catch (error) {
    console.error("Command API error:", error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}


