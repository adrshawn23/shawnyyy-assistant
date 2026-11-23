export function cleanData(rawRows: any[]) {
  return rawRows.map(row => ({
    ...row,
    hub: row.hub?.trim().toLowerCase(),
    status: row.status?.trim().toLowerCase(),
    // Keep leading zeros in ID
    trackingId: String(row.trackingId), 
    // Normalize date
    eventDate: new Date(row.eventDate),
  }));
}
