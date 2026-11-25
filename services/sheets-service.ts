// services/sheets-service.ts
import { getSheetsClient, extractSpreadsheetId } from '@/lib/google';

export async function fetchSheetData(url: string, range: string, accessToken: string) {
  const spreadsheetId = extractSpreadsheetId(url);
  if (!spreadsheetId) throw new Error("Invalid spreadsheet URL");

  const sheets = getSheetsClient(accessToken);
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
  });

  return response.data.values;
}

export async function writeSheetData(url: string, range: string, values: any[][], accessToken: string) {
  const spreadsheetId = extractSpreadsheetId(url);
  if (!spreadsheetId) throw new Error("Invalid spreadsheet URL");

  const sheets = getSheetsClient(accessToken);
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range,
    valueInputOption: 'RAW',
    requestBody: { values },
  });
}
