// Paste-ready Google Sheets formula generation.
// Every formula includes exact tab names, ranges, and the paste cell.

export interface FormulaSpec {
  kind: "latest_match" | "nth_match" | "column_fill";
  tab: string;
  keyColumn: string;   // e.g. "A"
  returnColumn: string; // e.g. "C"
  keyCell: string;    // e.g. "E2" — cell containing the lookup key
  nth?: number;       // for nth_match
  pasteCell: string;  // e.g. "F2"
  orderedBy?: "append" | "timestamp"; // append = last matching row; timestamp = max approved timestamp w/ tie-breaker
  timestampColumn?: string;
  tieBreakerColumn?: string;
}

function q(tab: string) {
  return `'${tab.replace(/'/g, "''")}'`;
}

// Latest match for append-ordered logs: last row where key column = key.
// =LOOKUP(2, 1/(keyrange=key), returnrange)  — classic last-match.
export function latestMatchAppend(spec: FormulaSpec): string {
  const keyRange = `${q(spec.tab)}!$${spec.keyColumn}$2:$${spec.keyColumn}$10000`;
  const retRange = `${q(spec.tab)}!$${spec.returnColumn}$2:$${spec.returnColumn}$10000`;
  return `=IFERROR(LOOKUP(2,1/(${keyRange}=${spec.keyCell}),${retRange}),"")`;
}

// Latest match for out-of-order logs: row with the max approved timestamp for
// the key. Two paste steps:
//   1) helper cell: max timestamp for the key (MAXIFS)
//   2) result cell:  last sheet row matching key AND that timestamp.
// Tie-breaker: when several rows share the max timestamp, the LAST row in sheet
// order wins (LOOKUP(2,1/(...))). Document this when approving the rule.
export function latestMatchTimestamp(spec: FormulaSpec): { helper: string; result: string; pasteHelperCell: string; pasteResultCell: string } {
  const ts = spec.timestampColumn || "B";
  const keyRange = `${q(spec.tab)}!$${spec.keyColumn}$2:$${spec.keyColumn}$10000`;
  const tsRange = `${q(spec.tab)}!$${ts}$2:$${ts}$10000`;
  const retRange = `${q(spec.tab)}!$${spec.returnColumn}$2:$${spec.returnColumn}$10000`;
  const helperCell = spec.pasteCell; // e.g. "H2"
  const resultCell = spec.tieBreakerColumn
    ? `${spec.tieBreakerColumn}${helperCell.replace(/\D+/g, "")}`
    : helperCell.replace(/([A-Z]+)/, (c) => String.fromCharCode(c.charCodeAt(0) + 1));
  const helper = `=IFERROR(MAXIFS(${tsRange},${keyRange},${spec.keyCell}),"")`;
  const result = `=IFERROR(LOOKUP(2,1/((${keyRange}=${spec.keyCell})*(${tsRange}=${helperCell})),${retRange}),"")`;
  return { helper, result, pasteHelperCell: helperCell, pasteResultCell: resultCell };
}

// Nth occurrence (e.g. second occurrence) of a key.
export function nthMatch(spec: FormulaSpec): string {
  const n = spec.nth || 2;
  const keyRange = `${q(spec.tab)}!$${spec.keyColumn}$2:$${spec.keyColumn}$10000`;
  const retRange = `${q(spec.tab)}!$${spec.returnColumn}$2:$${spec.returnColumn}$10000`;
  return `=IFERROR(INDEX(${retRange},SMALL(IF(${keyRange}=${spec.keyCell},ROW(${keyRange})-ROW(${keyRange})+2),${n})),"")`;
}

// Column-filling formula: drag down / ARRAYFORMULA for a whole column.
export function columnFill(spec: { tab: string; formula: string; targetColumn: string; rows?: number }): string {
  const rows = spec.rows || 1000;
  const range = `${q(spec.tab)}!$${spec.targetColumn}$2:$${spec.targetColumn}$${rows + 1}`;
  return `=ARRAYFORMULA(IF(ROW(${range})-1<=COUNTA(${q(spec.tab)}!$A$2:$A$${rows + 1}),${spec.formula},""))`;
}

export function describeFormula(spec: FormulaSpec): string {
  switch (spec.kind) {
    case "latest_match":
      return spec.orderedBy === "timestamp"
        ? "Latest match by approved timestamp (out-of-order log)"
        : "Latest match — last matching row (append-ordered log)";
    case "nth_match":
      return `${spec.nth || 2}${ordinal(spec.nth || 2)} occurrence of key`;
    case "column_fill":
      return "Column-filling array formula";
  }
}

function ordinal(n: number) {
  return n === 1 ? "st" : n === 2 ? "nd" : n === 3 ? "rd" : "th";
}
