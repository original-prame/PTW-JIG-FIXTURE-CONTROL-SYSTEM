// Small client-side helper for exporting tabular data to a downloadable
// .xlsx file, backed by the SheetJS "xlsx" package. Kept generic (array
// of headers + array-of-arrays of row values) so any tab can reuse it
// without needing to know anything about the xlsx API itself.

import * as XLSX from "xlsx";
import { convertToThaiDateFormat, getTodayIso } from "@/lib/thai-date";

export type ExcelCellValue = string | number;

/**
 * Builds a single-sheet workbook from `headers` + `rows` and triggers a
 * browser download named `filename` (should end in .xlsx).
 */
export function exportRowsToExcel(
  filename: string,
  sheetName: string,
  headers: string[],
  rows: ExcelCellValue[][],
): void {
  const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);

  // Auto-size columns roughly based on the longest value in each column,
  // so the exported file doesn't need manual column-width adjustment.
  const colWidths = headers.map((header, colIndex) => {
    const longest = rows.reduce((max, row) => {
      const cell = row[colIndex];
      const len = cell === undefined || cell === null ? 0 : String(cell).length;
      return Math.max(max, len);
    }, header.length);
    return { wch: Math.min(Math.max(longest + 2, 10), 50) };
  });
  worksheet["!cols"] = colWidths;

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  XLSX.writeFile(workbook, filename);
}

/** Converts an ISO "YYYY-MM-DD" date into a filename-safe Thai BE date label, e.g. "01-01-2568". */
export function exportFileDateLabel(isoDate: string): string {
  return convertToThaiDateFormat(isoDate).replace(/\//g, "-");
}

/** Today's date as a filename-safe Thai BE date label, e.g. "11-07-2569". */
export function exportTodayLabel(): string {
  return exportFileDateLabel(getTodayIso());
}
