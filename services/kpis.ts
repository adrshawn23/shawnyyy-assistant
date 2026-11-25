// KPI computation + reconciliation for hub reports.
// Every KPI declares whether it counts events or shipments and how excluded
// rows are handled.

import type { CleanRow } from "./cleaning";

export interface KpiDefinition {
  name: string;
  unit: "events" | "shipments";
  dateField: "eventDate";
  excludedRows: "excluded" | "included";
  description: string;
}

export const KPI_DEFINITIONS: KpiDefinition[] = [
  { name: "Total Events", unit: "events", dateField: "eventDate", excludedRows: "excluded",
    description: "Count of clean (non-flagged) rows in the reporting period. Each row is one shipment event." },
  { name: "Distinct Shipments", unit: "shipments", dateField: "eventDate", excludedRows: "excluded",
    description: "Count of unique Tracking IDs among clean rows. Repeated events for the same shipment count once." },
  { name: "Status Breakdown", unit: "events", dateField: "eventDate", excludedRows: "excluded",
    description: "Event count grouped by normalized Status." },
  { name: "Daily Trend", unit: "events", dateField: "eventDate", excludedRows: "excluded",
    description: "Event count per Event Date (ISO)." },
  { name: "Hub Comparison", unit: "events", dateField: "eventDate", excludedRows: "excluded",
    description: "Event count grouped by normalized Hub." },
];

export interface Period {
  start: string; // ISO yyyy-mm-dd inclusive
  end: string;   // ISO yyyy-mm-dd inclusive
}

export function inPeriod(row: CleanRow, p: Period): boolean {
  if (!row.eventDate) return false;
  return row.eventDate >= p.start && row.eventDate <= p.end;
}

export interface KpiResult {
  definitions: KpiDefinition[];
  period: Period;
  totals: {
    events: number;
    shipments: number;
    statusBreakdown: Record<string, number>;
    dailyTrend: { date: string; events: number }[];
    hubComparison: { hub: string; events: number; shipments: number }[];
  };
  filteredRowCount: number;
}

export function computeKpis(rows: CleanRow[], period: Period): KpiResult {
  const clean = rows.filter((r) => !r.excluded && inPeriod(r, period));

  const statusBreakdown: Record<string, number> = {};
  const dailyMap = new Map<string, number>();
  const hubMap = new Map<string, { events: number; ids: Set<string> }>();
  const shipmentIds = new Set<string>();

  for (const r of clean) {
    shipmentIds.add(r.trackingId);
    statusBreakdown[r.status || "(blank)"] = (statusBreakdown[r.status || "(blank)"] || 0) + 1;
    dailyMap.set(r.eventDate, (dailyMap.get(r.eventDate) || 0) + 1);
    const h = r.hub || "(blank)";
    const cur = hubMap.get(h) || { events: 0, ids: new Set<string>() };
    cur.events += 1;
    cur.ids.add(r.trackingId);
    hubMap.set(h, cur);
  }

  return {
    definitions: KPI_DEFINITIONS,
    period,
    totals: {
      events: clean.length,
      shipments: shipmentIds.size,
      statusBreakdown,
      dailyTrend: [...dailyMap.entries()].sort().map(([date, events]) => ({ date, events })),
      hubComparison: [...hubMap.entries()]
        .map(([hub, v]) => ({ hub, events: v.events, shipments: v.ids.size }))
        .sort((a, b) => b.events - a.events),
    },
    filteredRowCount: clean.length,
  };
}

// ---------- reconciliation ----------
// source rows must equal clean + flagged. Filtered totals must match the sum
// of rows that pass the period filter.

export interface Reconciliation {
  ok: boolean;
  sourceRows: number;
  cleanRows: number;
  flaggedRows: number;
  filteredEvents: number;
  filteredShipments: number;
  checks: { name: string; ok: boolean; detail: string }[];
  failures: string[];
}

export function reconcile(
  sourceRowCount: number,
  rows: CleanRow[],
  kpi: KpiResult
): Reconciliation {
  const checks: Reconciliation["checks"] = [];
  const failures: string[] = [];

  const cleanCount = rows.filter((r) => !r.excluded).length;
  const flaggedCount = rows.filter((r) => r.excluded).length;
  const rowSumOk = cleanCount + flaggedCount === sourceRowCount && rows.length === sourceRowCount;
  checks.push({
    name: "row_reconciliation",
    ok: rowSumOk,
    detail: `source=${sourceRowCount}, clean=${cleanCount}, flagged=${flaggedCount}`,
  });
  if (!rowSumOk) failures.push("Row counts do not reconcile: source != clean + flagged.");

  // filtered total = number of non-excluded rows inside the period
  const expectedEvents = rows.filter((r) => !r.excluded && inPeriod(r, kpi.period)).length;
  const eventsOk = expectedEvents === kpi.totals.events;
  checks.push({
    name: "filtered_total",
    ok: eventsOk,
    detail: `expected=${expectedEvents}, reported=${kpi.totals.events}`,
  });
  if (!eventsOk) failures.push("Filtered event total does not match row-level count.");

  // shipments <= events always
  const shipOk = kpi.totals.shipments <= kpi.totals.events;
  checks.push({
    name: "shipment_cardinality",
    ok: shipOk,
    detail: `shipments=${kpi.totals.shipments}, events=${kpi.totals.events}`,
  });
  if (!shipOk) failures.push("Distinct shipments exceed event count — impossible.");

  return {
    ok: failures.length === 0,
    sourceRows: sourceRowCount,
    cleanRows: cleanCount,
    flaggedRows: flaggedCount,
    filteredEvents: kpi.totals.events,
    filteredShipments: kpi.totals.shipments,
    checks,
    failures,
  };
}
