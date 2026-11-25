import { google } from 'googleapis';

const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    // Forcefully replace literal "\n" strings with actual newline characters
    private_key: process.env.GOOGLE_SERVICE_ACCOUNT_KEY?.split('\\n').join('\n'),
  },
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

export const sheets = google.sheets({ version: 'v4', auth });

export function extractSpreadsheetId(url: string): string | null {
  const match = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : null;
}

export async function verifyWorkbookAccess(spreadsheetId: string): Promise<boolean> {
  try {
    await sheets.spreadsheets.get({ spreadsheetId });
    return true;
  } catch (error) {
    console.error('Access verification failed:', error);
    return false;
  }
}
