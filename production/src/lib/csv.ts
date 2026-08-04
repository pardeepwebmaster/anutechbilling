/**
 * CSV export helpers — shared so every report (GST, P&L, Balance Sheet, …) hands
 * the CA the same, spreadsheet-clean format. Amounts are written as raw integer ₹
 * (the app's canonical money unit), not formatted strings, so Excel/Tally treats
 * them as numbers.
 */

/** Escape a CSV field (RFC 4180): quote it when it contains a comma, quote, or newline. */
export function csvEscape(s: string | number | null | undefined): string {
  const v = String(s ?? "");
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

/** Build a CSV string from headers + rows and trigger a browser download. */
export function downloadCSV(
  filename: string,
  headers: string[],
  rows: (string | number)[][],
): void {
  const lines = [
    headers.map(csvEscape).join(","),
    ...rows.map((r) => r.map(csvEscape).join(",")),
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
