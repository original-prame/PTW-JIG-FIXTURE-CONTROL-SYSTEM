// Thai (Buddhist Era) date helpers shared across the dashboard.
//
// The app stores/display dates as "DD/MM/YYYY" strings in the Buddhist
// Era (BE = CE + 543), while HTML <input type="date"> and JS `Date`
// objects work in the Gregorian (CE) calendar as ISO "YYYY-MM-DD"
// strings. These helpers convert between the two representations.

export const THAI_MONTHS = [
  "มกราคม",
  "กุมภาพันธ์",
  "มีนาคม",
  "เมษายน",
  "พฤษภาคม",
  "มิถุนายน",
  "กรกฎาคม",
  "สิงหาคม",
  "กันยายน",
  "ตุลาคม",
  "พฤศจิกายน",
  "ธันวาคม",
] as const;

export const THAI_DAYS_SHORT = ["จ", "อ", "พ", "พฤ", "ศ", "ส", "อา"] as const;

export const BE_OFFSET = 543;

export function getCurrentYearCE(): number {
  return new Date().getFullYear();
}

export function getCurrentYearBE(): number {
  return getCurrentYearCE() + BE_OFFSET;
}

/** Converts an ISO "YYYY-MM-DD" (CE) string to a Thai "DD/MM/YYYY" (BE) string. */
export function convertToThaiDateFormat(isoDateString: string): string {
  if (!isoDateString) return "";
  const [year, month, day] = isoDateString.split("-");
  const thaiYear = parseInt(year) + BE_OFFSET;
  return `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}/${thaiYear}`;
}

/** Converts a Thai "DD/MM/YYYY" (BE) string to an ISO "YYYY-MM-DD" (CE) string. */
export function convertThaiDateToIso(thaiDateStr: string): string {
  if (!thaiDateStr) return "";
  const parts = thaiDateStr.split("/");
  if (parts.length !== 3) return "";
  const isoYear = parseInt(parts[2]) - BE_OFFSET;
  return `${isoYear}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
}

/** Parses a Thai "DD/MM/YYYY" (BE) string into a JS Date (CE). */
export function parseThaiDateToObj(thaiDateStr: string): Date | null {
  if (!thaiDateStr) return null;
  const parts = thaiDateStr.split("/");
  if (parts.length !== 3) return null;
  return new Date(
    parseInt(parts[2]) - BE_OFFSET,
    parseInt(parts[1]) - 1,
    parseInt(parts[0]),
  );
}

/** Today's date as an ISO "YYYY-MM-DD" string, in local time (not UTC). */
export function getTodayIso(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function defaultFinancialRange(): {
  start: string;
  end: string;
} {
  const yearBE = getCurrentYearBE();
  return {
    start: `01/01/${yearBE}`,
    end: `31/12/${yearBE}`,
  };
}
