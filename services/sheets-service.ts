// services/sheets-service.ts
import { sheets, extractSpreadsheetId } from '@/lib/google';

export async function fetchSheetData(url: string, range: string) {
  const spreadsheetId = extractSpreadsheetId(url);
  if (!spreadsheetId) throw new Error("Invalid spreadsheet URL");

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
  });

  return response.data.values;
}

export async function writeSheetData(url: string, range: string, values: any[][]) {
  const spreadsheetId = extractSpreadsheetId(url);
  if (!spreadsheetId) throw new Error("Invalid spreadsheet URL");

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range,
    valueInputOption: 'RAW',
    requestBody: { values },
  });
}
