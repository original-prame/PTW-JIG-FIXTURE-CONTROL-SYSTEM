// Price/currency formatting helpers, shared by every place that displays
// or collects the job "Price" field (it's stored as a free-text string
// in the sheet, e.g. "15,000", so these keep that formatting consistent
// wherever it shows up: the production table, the add-job form, and the
// edit-job modal).

/**
 * Formats raw user input into a "12,345.67"-style string as they type:
 * strips anything that isn't a digit or a decimal point, keeps at most
 * one decimal point, caps the decimal part to 2 digits, and inserts
 * thousands separators.
 */
export function formatPriceInput(raw: string): string {
  const cleaned = raw.replace(/[^\d.]/g, "");
  const firstDot = cleaned.indexOf(".");
  const intPartRaw = firstDot === -1 ? cleaned : cleaned.slice(0, firstDot);
  const decPartRaw = firstDot === -1 ? "" : cleaned.slice(firstDot + 1).replace(/\./g, "").slice(0, 2);

  const intPart = intPartRaw.replace(/^0+(?=\d)/, "");
  const withCommas = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

  if (firstDot === -1) return withCommas;
  return `${withCommas}.${decPartRaw}`;
}

/** Parses a formatted/raw price string (e.g. "15,000") into a number, or 0 if unparseable. */
export function parsePrice(value?: string): number {
  if (!value) return 0;
  const numeric = parseFloat(value.replace(/,/g, ""));
  return isNaN(numeric) ? 0 : numeric;
}

/** Formats a price string for read-only display, e.g. "15000" -> "15,000.00 บาท". Returns "-" when empty. */
export function formatCurrencyDisplay(value?: string): string {
  if (!value || !value.trim()) return "-";
  const numeric = parseFloat(value.replace(/,/g, ""));
  if (isNaN(numeric)) return value;
  return (
    numeric.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " บาท"
  );
}
