// Best-effort heuristic extraction of new-job form fields from raw text
// pulled out of an uploaded PDF (see lib/pdf-ocr.ts).
//
// Tuned against four real customer PO/quotation documents (Fusion
// Advantec, Kimball Electronics, Katolec, Benchmark Electronics), which
// turned out to use quite different layouts and languages. Two important
// lessons from testing against the *actual* text pdfjs-dist hands back
// (not a hand-tidied reference transcript):
//   - A PO commonly lists MULTIPLE line items in one table, each of which
//     should become its own row in the Add Job form. extractJobFieldsFromText
//     therefore returns an ARRAY of rows, one per detected item, all
//     sharing the document-level fields (customer/PO/quotation/PO date)
//     but each with its own description/qty/price and (when the document
//     gives a per-item delivery date) its own due date.
//   - An item's description is very often split across more than one
//     line (a short title line plus a "Model : ..." / continuation line
//     directly below it), so each row's description is built by joining
//     every content line that belongs to that item's block, not just the
//     first one.
//
// Other recurring signals across the sample set:
//   - PTW's own quotation numbers always look like "PTW-2506031" /
//     "PTW-26003001" regardless of which customer issued the PO, so that
//     pattern is matched first and doesn't depend on finding a label.
//   - Dates show up in at least four different shapes: "07-11-2025",
//     "10-Sep-2025", "29 APRIL 2026" and "04.05.2026" - all four are
//     matched, and the label-to-value gap is restricted to the same line
//     so a label can't accidentally "reach across" a page break to a
//     completely unrelated number.
//   - The customer is never PTW itself; it's whichever "___ Co.,Ltd" /
//     "___ Ltd." / "___ PCL" / "บริษัท ___" company name appears first
//     that isn't PTW.
//   - Every sample filename happens to already be the customer's own PO
//     number (e.g. "TPC088611.pdf", "4503877013.pdf"), so the filename is
//     used as a last-resort fallback for the PO number field.
//
// PO/quotation layouts still vary a lot beyond these four samples, so
// this remains a best-effort first draft - fields it can't confidently
// find are reported back via `missingFields` so the UI can flag them for
// manual review rather than silently leaving them blank or wrong.

import { NewJobForm } from "@/app/types";
import { getTodayIso } from "@/lib/thai-date";

export interface ParsedJobRow {
  fields: Partial<NewJobForm>;
  missingFields: string[];
}

const FIELD_LABELS_TH: Record<string, string> = {
  customer: "ลูกค้า",
  desc: "รายละเอียดงาน",
  qty: "จำนวน",
  po: "เลขที่ใบสั่งซื้อ",
  quote: "เลขที่ใบเสนอราคา",
  price: "ราคา",
  dueDate: "วันกำหนดส่งมอบ",
  poDate: "วันที่ใบสั่งซื้อ",
};

// Horizontal-whitespace-only gap between a label and its value, so a
// match can never silently "jump" across a newline to an unrelated
// number/date elsewhere in the document (this was a real bug: a bare
// \s* here let "Net Price ... Net Amount\n\n0010  ASSEMBLY..." match
// "0010" - the item code on the next table row - as if it were a price).
const GAP = "[ \\t]*[:\\-]?[ \\t]*";

// Matches 07-11-2025 / 10-Sep-2025 / 29 APRIL 2026 / 04.05.2026
const DATE_FRAGMENT =
  "\\d{1,2}\\s*[\\-\\/.]\\s*[A-Za-z]{3,9}\\s*[\\-\\/.]\\s*\\d{2,4}|\\d{1,2}\\s+[A-Za-z]{3,9}\\s+\\d{2,4}|\\d{1,2}[\\-\\/.]\\d{1,2}[\\-\\/.]\\d{2,4}";

const EN_MONTHS_ABBR = [
  "jan", "feb", "mar", "apr", "may", "jun",
  "jul", "aug", "sep", "oct", "nov", "dec",
];

function monthNameToNumber(name: string): number | null {
  const idx = EN_MONTHS_ABBR.indexOf(name.toLowerCase().slice(0, 3));
  return idx === -1 ? null : idx + 1;
}

function normalizeFoundDate(raw: string): string | null {
  const monthNameMatch = raw.match(/(\d{1,2})\s*[\-\/.\s]\s*([A-Za-z]{3,9})\s*[\-\/.\s]\s*(\d{2,4})/);
  if (monthNameMatch) {
    const day = parseInt(monthNameMatch[1], 10);
    const month = monthNameToNumber(monthNameMatch[2]);
    let year = parseInt(monthNameMatch[3], 10);
    if (month && day >= 1 && day <= 31) {
      if (year < 100) year += 2000;
      if (year > 2400) year -= 543;
      return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }
  const cleaned = raw.replace(/\s+/g, "").replace(/[.\-]/g, "/");
  const parts = cleaned.split("/");
  if (parts.length !== 3) return null;
  let day = parseInt(parts[0], 10);
  let month = parseInt(parts[1], 10);
  let year = parseInt(parts[2], 10);
  if (!day || !month || !year) return null;
  if (month > 12 && day <= 12) [day, month] = [month, day];
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  if (year < 100) year += 2000;
  if (year > 2400) year -= 543;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function matchFirst(text: string, patterns: RegExp[]): string | null {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) return match[1].trim();
  }
  return null;
}

// Finds the first date-like fragment appearing shortly after `labelPattern`
// in the raw text, searching across line breaks (unlike the strict
// same-line label regexes) - used as a fallback for tabular layouts where
// a column header (e.g. "Requested Date") is far from its actual value,
// which sits a couple of rows below it instead of right next to it.
function findDateNear(text: string, labelPattern: RegExp): string | null {
  const idx = text.search(labelPattern);
  if (idx === -1) return null;
  const window = text.slice(idx, idx + 400);
  const matches = window.match(new RegExp(DATE_FRAGMENT, "gi")) || [];
  for (const m of matches) {
    if (/^mm/i.test(m)) continue; // "mm/dd/yyyy" placeholder header
    const iso = normalizeFoundDate(m);
    if (iso) return iso;
  }
  return null;
}

// A short standalone word near the very top of the document, e.g. a
// letterhead/logo caption like "Benchmark." sitting above the rest of the
// address block. When present this is usually the cleanest, most reliable
// reading of the customer's name - company address blocks are often long
// and Thai text in particular is prone to PDF font-encoding glitches
// (combining vowel marks coming out reordered/decomposed), so a short
// all-English caption is preferred over both of those when it exists.
function extractShortLogoName(lines: string[]): string | null {
  for (const line of lines.slice(0, 5)) {
    if (/ptw/i.test(line)) continue;
    const m = line.match(/^([A-Za-z]{3,20})\.?\s*$/);
    if (m) return m[1];
  }
  return null;
}

// Recurring customers, matched anywhere in the document and mapped to the
// exact name the business uses for them. OCR renders company names with
// unpredictable noise around them ("> Benchmark.", "GO KATOLEC (THAILAND)
// CO., LTD." - the "GO" is a misread logo fragment), so recognising a
// distinctive substring and substituting the canonical name is far more
// reliable than trying to clean up whatever surrounds it. When several
// known customers appear (e.g. one is mentioned inside another's PO terms),
// the one appearing earliest in the document wins - the issuing company's
// letterhead is always at the very top.
const KNOWN_CUSTOMERS: Array<{ pattern: RegExp; canonical: string }> = [
  { pattern: /benchmark/i, canonical: "BENCHMARK" },
  { pattern: /katolec/i, canonical: "Katolec (THAILAND) CO., LTD." },
];

function matchKnownCustomer(text: string): string | null {
  let best: { idx: number; canonical: string } | null = null;
  for (const { pattern, canonical } of KNOWN_CUSTOMERS) {
    const idx = text.search(pattern);
    if (idx !== -1 && (!best || idx < best.idx)) best = { idx, canonical };
  }
  return best ? best.canonical : null;
}

function extractCustomerName(text: string): string | null {
  const known = matchKnownCustomer(text);
  if (known) return known;

  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);

  const logoName = extractShortLogoName(lines);
  if (logoName) return logoName;

  // Prefer a cleanly-encoded English company name over a Thai one: Thai
  // text extracted from some PDFs' embedded fonts comes out with its vowel
  // marks in the wrong order (a source-side font/encoding issue, not
  // something fixable by regex), while the same document's English name
  // usually reads correctly.
  for (const line of lines) {
    if (/ptw/i.test(line)) continue;
    if (/^(order to|vendor|customer|attn|attention|address|ship to|bill to)\s*[:\-]/i.test(line)) continue;
    const enMatch = line.match(
      /^([A-Za-z][A-Za-z0-9\s.,()&\-]{2,60}?(?:Co\.,?\s?Ltd\.?|Company\s+Limited|PCL\.?|Public\s+Company\s+Limited|Ltd\.?))\b/i,
    );
    if (enMatch) {
      // Strip generic signature-block filler that sometimes precedes the
      // company name on the same line (e.g. "For Supplier Use Fusion
      // Advantec Co.,Ltd." in a form's signature section).
      let cleaned = enMatch[1].replace(/^(?:for\s+supplier\s+use|authorized|purchaser|acknowledged(?:\s+and\s+confirm)?)\s+/i, "").trim();
      // OCR of a logo often leaves a stray 1-2 letter fragment glued in
      // front of the real name ("GO KATOLEC (THAILAND) CO., LTD.").
      cleaned = cleaned.replace(/^[A-Za-z]{1,2}\s+(?=[A-Za-z]{3})/, "").trim();
      if (cleaned) return cleaned;
    }
  }
  for (const line of lines) {
    if (/ptw/i.test(line)) continue;
    const thaiMatch = line.match(/บริษัท\s+([^\n(]{2,60})/);
    if (thaiMatch) return `บริษัท ${thaiMatch[1].trim()}`;
  }
  return null;
}

function poNumberFromFilename(filename?: string): string | null {
  if (!filename) return null;
  const base = filename.replace(/\.pdf$/i, "").replace(/[_\s]*ptw[_\s]*/gi, " ").trim();
  return base.length >= 3 ? base : null;
}

// Lines that are clearly table-header / boilerplate noise rather than
// actual line-item content.
const NOISE_LINE = /^(no\.?|item\b|pos\/?\s*seq|description\b|qty\b|quantity\b|unit\.?\b|price\b|amount\b|carrier\b|delivery\b|confirmed\b|requested\b|tax\b|discount\b|material\b|total\b|change\s*order|mm\s*\/\s*dd\s*\/\s*yyyy|customer\s*advance|none\s*applicable|goods\s*costs)/i;

function looksLikeContentLine(line: string): boolean {
  if (NOISE_LINE.test(line)) return false;
  if (/^[\d.,\-\/\s%$฿]+$/.test(line)) return false; // pure numeric/symbols
  // A run of isolated single Thai characters ("็ 7 ฝ 07 ไ 7107 ฝ ล ล ล")
  // is OCR debris from signatures/stamps/table borders, not real Thai text
  // (real Thai words are multi-character tokens).
  const thaiSingles = (line.match(/(?:^|\s)[ก-๙](?=\s|$)/g) || []).length;
  if (thaiSingles >= 3) return false;
  const letterCount = (line.match(/[A-Za-z฀-๿]/g) || []).length;
  return letterCount >= 4;
}

// Recognisable unit-of-measure codes that show up right after a quantity
// in a table row (e.g. "3 EA", "2.00 SET"), whitelisted rather than
// matched generically so a real word at the end of a description (e.g.
// "...Production Supplies Modify") never gets mistaken for one.
const UNIT_CODE = /\s+(?:EA|SET|PCS|PC|UNIT|UNITS|NOS|KG|BOX|LOT|EACH)\.?$/i;

// Like DATE_FRAGMENT but the all-numeric form requires a 4-digit year:
// used when stripping dates out of DESCRIPTIONS, where a Thai size range
// ("ขนาด 1.5-10 มิล") would otherwise be mistaken for a d.m-yy date and
// take the rest of the description with it.
const DESC_DATE_FRAGMENT =
  "\\d{1,2}\\s*[\\-\\/.]\\s*[A-Za-z]{3,9}\\s*[\\-\\/.]\\s*\\d{2,4}|\\d{1,2}\\s+[A-Za-z]{3,9}\\s+\\d{2,4}|\\d{1,2}[\\-\\/.]\\d{1,2}[\\-\\/.]\\d{4}";

function cleanDescPart(line: string, isFirst: boolean): string {
  let out = line;
  if (isFirst) out = out.replace(/^\d+(?:\/\s*\d+)?\s+/, "");
  // Table-border debris glued to the front of the description cell
  // ("2 |PB SWISS TOOLS...", "9 (ประแจปากตาย..."), sometimes with a short
  // Thai misread of the border in front ("ใไเ (สีผสม...").
  if (isFirst) out = out.replace(/^[ก-๙]{1,3}(?=\s*\()/, "").trim();
  if (isFirst) out = out.replace(/^[|\[\](]+\s*/, "");
  // Trailing date (and everything after it, e.g. qty/unit/price columns
  // that followed the date on the same row).
  out = out.replace(new RegExp(`\\s+(?:${DESC_DATE_FRAGMENT}).*$`, "i"), "");
  // Trailing run of pure numeric tokens (qty, prices, amounts).
  out = out.replace(/(?:\s+[\d,]+(?:\.\d+)?)+$/, "");
  // A unit code left dangling after the numbers before it were stripped.
  out = out.replace(UNIT_CODE, "");
  // In case a unit code preceded more numbers (e.g. "3 EA 8,000.00" ->
  // stripped to "3 EA" -> now "3" needs stripping too).
  out = out.replace(/(?:\s+[\d,]+(?:\.\d+)?)+$/, "");
  // A lone trailing lowercase letter is OCR debris from a table border
  // ("...(TOP SIDE) i"), never real content.
  out = out.replace(/\s+[a-zก-๙]$/, "");
  return out.replace(/\s{2,}/g, " ").trim();
}

interface RowBlock {
  descLines: string[];
  dataLines: string[];
  dueDate?: string;
}

// A line that starts a new table row: an item number/code followed by
// real content, e.g. "1 SPP-PT-07...", "0010 ASSEMBLY BAKER...",
// "20/ 0 899-246-000 CUSTOMER..." or "10/ เจ 899-..." (the "0" after the
// slash misread as junk).
const ITEM_START_RE = /^\d{1,4}\s*\/\s*\S+\s+\S|^\d{1,4}\s+\S/;

// An item row whose leading item number was swallowed by OCR entirely:
// starts with a word and ends with the unit-price/amount money columns
// ("PCB Cutting Jig 2 9,500.00 19,000.00", "Jig assy screw after fit
// P1-P4 for PSEL 14,200.00 14,200.00"). Requires a thousands separator in
// the final amount so short decimals inside a sentence can't trigger it.
const HEADLESS_ITEM_RE =
  /^[A-Za-zก-๙].*\s\d{1,3}(?:,\d{3})*\.\d{2}\s+\d{1,3}(?:,\d{3})+\.\d{2}\s*$|^[A-Za-zก-๙].*\s\d{1,3}(?:,\d{3})+\.\d{2}\s*$/;

// Lines that signal the item table has ended and what follows is
// boilerplate / terms text that should never be scanned for line items.
const BLOCK_END_MARKERS =
  /^(remark|quotation no|requisitioner|total excl|standard notes|a packing list|it is the responsibility|goods shipped in advance|material needs to be shipped|please note that purchase|expedited freight|an acknowledgement|far and dfar|please reference our quality|by$|purchase order$|page\s*\d+\s*of|for supplier use|acknowledged and confirm|before discount|after discount|include vat|grand total|^discount$|^vat\s|^quotation$|we thank for your enquiry|^\d\.\s*(material|design|transportation|machinery|other))/i;

// Totals / signature boilerplate that can appear ANYWHERE in a line (OCR
// of a scanned table often reads the totals column before the item rows,
// with stray digits/symbols glued to the front - "0 (AFTER DISCOUNT)
// TOTAL"), so unlike BLOCK_END_MARKERS these are not anchored to the line
// start. A line matching this is never item content; the scan skips it
// (closing any open block) but keeps looking for item rows, because with
// a scrambled reading order real rows can legitimately appear after it.
const BLOCK_END_ANYWHERE =
  /(?:before|after)\s+discount|grand\s+total|please\s+sign\s+this\s+page|received\s*\/?\s*confirmed|prepared\s+checked\s+approved|include\s+vat|\bdiscount\b|\btotal\b(?=[^\n]*\d)|\(\s*type\b|type\s*.{0,3}\/\s*model|model\s*\/\s*colou?r/i;

const DELIVERY_TAX_SUBLINE = /^(delivery date|tax)\s*:/i;

function findDescriptionHeaderIndex(lines: string[]): number {
  for (let i = 0; i < lines.length; i++) {
    if (/description/i.test(lines[i])) return i;
  }
  return -1;
}

// Style B: a "Description" table-column header followed by one or more
// repeating item rows (Fusion, Kimball, Katolec-style layouts).
function extractHeaderStyleBlocks(
  lines: string[],
  logoName?: string | null,
  allowSalvage = false,
): RowBlock[] {
  const headerIdx = findDescriptionHeaderIndex(lines);
  if (headerIdx === -1) return [];

  const blocks: RowBlock[] = [];
  let current: RowBlock | null = null;
  // Item numbers on a PO only ever increase. A line starting with a number
  // that does NOT continue the sequence and does NOT end in a money amount
  // is body text that merely begins with a digit ("7 ชิ้น ขนาด 1.5-6 มิล",
  // "4 DS700P-SPANNER SET 7 PCS.") or totals-area junk ("0 เทพ...") - not
  // a new item row.
  let lastItemNo = 0;

  for (let i = headerIdx + 1; i < lines.length; i++) {
    const line = lines[i];
    // Hard terminators (start-anchored, e.g. "Total excl. tax", "Remark")
    // end the table scan outright; the looser anywhere-markers only skip
    // the line, because with OCR's scrambled reading order real item rows
    // can still appear after a totals/signature line.
    if (BLOCK_END_MARKERS.test(line)) break;
    if (BLOCK_END_ANYWHERE.test(line)) {
      if (current) {
        blocks.push(current);
        current = null;
      }
      continue;
    }
    if (logoName && new RegExp(`^${logoName}\\.?$`, "i").test(line)) break;

    if (/^#|\s#[A-Za-zก-๙]/.test(line)) {
      if (current) {
        // OCR sometimes merges the "Model : ..." description line into the
        // "#" comment that follows it ("# Initail cost (...) Model : PSEL")
        // - salvage the model fragment before closing the block.
        const model = line.match(/Model\s*:\s*.+$/i);
        if (model) {
          current.descLines.push(model[0]);
        }
        blocks.push(current);
        current = null;
      }
      continue;
    }

    if (/description/i.test(line)) {
      if (blocks.length === 0 && !current) continue; // repeated header before any items - keep scanning
      break; // repeated header on a later page - table is over
    }

    if (DELIVERY_TAX_SUBLINE.test(line)) {
      if (current) {
        const dateMatch = line.match(new RegExp(DATE_FRAGMENT, "i"));
        if (dateMatch && !current.dueDate) {
          const iso = normalizeFoundDate(dateMatch[0]);
          if (iso) current.dueDate = iso;
        }
        current.dataLines.push(line);
      }
      continue;
    }

    const numMatch = line.match(/^(\d{1,4})/);
    const candidateNo = numMatch ? parseInt(numMatch[1], 10) : null;
    const hasMoneyTail = /\d\.\d{2}\s*$/.test(line);
    // A cell border ("|", "[", "(") right after the number is how the qty
    // column's edge shows up on these tables - a strong item-row signal
    // that body text starting with a number ("7 ชิ้น ขนาด 1.5-6 มิล")
    // never has.
    const hasCellBorder = /^\d{1,4}\s*[|\[(]/.test(line);
    const startsNumbered =
      ITEM_START_RE.test(line) &&
      candidateNo !== null &&
      (hasMoneyTail || (candidateNo > lastItemNo && hasCellBorder));
    if ((startsNumbered || HEADLESS_ITEM_RE.test(line)) && looksLikeContentLine(line)) {
      if (current) blocks.push(current);
      current = { descLines: [line], dataLines: [line] };
      if (startsNumbered && candidateNo !== null && candidateNo > lastItemNo) {
        lastItemNo = candidateNo;
      }
      continue;
    }

    if (current && looksLikeContentLine(line)) {
      current.descLines.push(line);
      current.dataLines.push(line);
    }
  }
  if (current) blocks.push(current);

  // Salvage pass (only when explicitly requested - see the caller): the
  // table header exists but no row was recognisable as an item (OCR lost
  // the qty/price columns completely, e.g. the Katolec G1150 PO where only
  // "PCB CUTTING JIG MODEL : FM3-H914" survived). Collect the first short
  // run of plain content lines after the header as one desc-only item so
  // at least the description reaches the form; qty/price stay empty and
  // get flagged for manual entry.
  if (allowSalvage && blocks.length === 0) {
    const salvage: RowBlock = { descLines: [], dataLines: [] };
    for (let i = headerIdx + 1; i < lines.length; i++) {
      const line = lines[i];
      if (/^#|\s#[A-Za-zก-๙]/.test(line) || BLOCK_END_MARKERS.test(line) || BLOCK_END_ANYWHERE.test(line)) {
        if (salvage.descLines.length > 0) break;
        continue;
      }
      if (!looksLikeContentLine(line)) {
        if (salvage.descLines.length > 0) break;
        continue;
      }
      salvage.descLines.push(line);
      salvage.dataLines.push(line);
      if (salvage.descLines.length >= 4) break;
    }
    if (salvage.descLines.length > 0) blocks.push(salvage);
  }
  return blocks;
}

// Style A: a trailing "Description:" sub-label per item, with the qty/
// price/date data row *preceding* the label and the description text
// *following* it (Benchmark-style layouts).
function extractLabelStyleBlocks(lines: string[], logoName?: string | null): RowBlock[] {
  const labelIndices: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (/description\s*:\s*[^\wก-๙]{0,3}$/i.test(lines[i])) labelIndices.push(i);
  }
  if (labelIndices.length === 0) return [];

  const blocks: RowBlock[] = [];
  for (let k = 0; k < labelIndices.length; k++) {
    const idx = labelIndices[k];
    const descStart = idx + 1;
    let descEnd = lines.length;
    for (let j = descStart; j < lines.length; j++) {
      const isRepeatedLetterhead =
        logoName && new RegExp(`^${logoName}\\.?$`, "i").test(lines[j]);
      if (
        j > descStart &&
        (/description\s*:\s*$/i.test(lines[j]) ||
          ITEM_START_RE.test(lines[j]) ||
          BLOCK_END_MARKERS.test(lines[j]) ||
          BLOCK_END_ANYWHERE.test(lines[j]) ||
          isRepeatedLetterhead)
      ) {
        descEnd = j;
        break;
      }
    }
    const descLines = lines.slice(descStart, descEnd).filter(looksLikeContentLine);

    const prevBoundary = k > 0 ? labelIndices[k - 1] + 1 : 0;
    const dataLines = lines.slice(Math.max(prevBoundary, idx - 4), idx + 1);

    if (descLines.length > 0) blocks.push({ descLines, dataLines });
  }
  return blocks;
}

function buildDescription(block: RowBlock): string {
  const seen = new Set<string>();
  const parts: string[] = [];
  block.descLines.forEach((line, idx) => {
    const cleaned = cleanDescPart(line, idx === 0);
    if (!cleaned) return;
    const key = cleaned.toLowerCase();
    // Some PO layouts (Katolec) repeat the same "Model : ..." line twice
    // for form-formatting reasons - don't duplicate it in the joined
    // description. Likewise a "Model : X" line adds nothing when X is
    // already part of the description ("PCB CUTTING JIG MODEL : FM3-H914"
    // followed by "Model : FM3-H914").
    if (seen.has(key)) return;
    const modelOnly = cleaned.match(/^Model\s*:\s*(.+)$/i);
    if (modelOnly) {
      const canon = (s: string) => s.toLowerCase().replace(/[\s:]+/g, "");
      if (canon(parts.join(" ")).includes(`model${canon(modelOnly[1])}`)) return;
    }
    seen.add(key);
    parts.push(cleaned);
  });
  return parts.join(" ").trim();
}

// The job "Price" field is stored as a free-text string with thousands
// separators (e.g. "15,000" - see lib/format.ts), but scanned POs often
// print prices without them ("8800.00000"), so every price this parser
// emits is re-formatted to the "8,800.00" shape the rest of the app uses.
function formatPriceValue(num: number): string {
  return num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function extractQtyPriceFromLine(line: string): { qty?: number; price?: string } {
  // Some layouts (Benchmark) put two "qty" columns then two date columns
  // then the price, e.g. "1.0000 1.0000 07-11-2025 07-11-2025 8800.00000
  // THB ST 8800.00" - match that specific shape directly on the original
  // line first, since after stripping the dates the qty figure repeats
  // right next to itself and can be mistaken for a (truncated) price.
  const rowShape = new RegExp(
    `^(\\d+(?:\\.\\d+)?)\\s+\\d+(?:\\.\\d+)?\\s+(?:${DATE_FRAGMENT})\\s+(?:${DATE_FRAGMENT})\\s+(\\d+(?:\\.\\d+)?)`,
    "i",
  );
  const rowMatch = line.match(rowShape);
  if (rowMatch) {
    const qtyNum = parseFloat(rowMatch[1]);
    const priceNum = parseFloat(rowMatch[2]);
    const result: { qty?: number; price?: string } = {};
    if (qtyNum > 0 && qtyNum < 100000) result.qty = Math.round(qtyNum);
    // Truncate (not round) to 2 decimals: these columns print prices with
    // 5 decimal places whose tail is always zeros, so any nonzero digit
    // out there (e.g. "4300.00606") is OCR speckle, not a real fraction -
    // rounding it up would corrupt the price by a satang.
    if (priceNum > 0) result.price = formatPriceValue(Math.floor(priceNum * 100) / 100);
    if (result.qty !== undefined || result.price !== undefined) return result;
  }

  // Strip out any date fragments first so a year like "...-2025" can never
  // be mistaken for the quantity of the row.
  const cleaned = line.replace(new RegExp(DATE_FRAGMENT, "gi"), " ");
  // (?<![\d,.]) keeps the qty capture from starting mid-number (real bug:
  // "Jig 9,500.00 19,000.00" matched qty "500" out of "9,500.00").
  // Qty accepts "3" / "2.0000" but NOT "950.00" - a nonzero decimal part
  // means the token is a price (real bug: "... 950.00 950.00" made qty 950).
  const m = cleaned.match(/(?<![\d,.])(\d{1,5}(?:\.0{3,4})?)\s+(?:[A-Za-z]{1,6}\.?\s+)?(\d{1,3}(?:,\d{3})*\.\d{2})(?!\d)/);
  if (m) {
    const qtyNum = parseFloat(m[1]);
    const result: { qty?: number; price?: string } = {
      price: formatPriceValue(parseFloat(m[2].replace(/,/g, ""))),
    };
    if (qtyNum > 0 && qtyNum < 100000) result.qty = Math.round(qtyNum);
    return result;
  }

  // A row whose qty digit was swallowed by OCR entirely ("1 PCB Cutting
  // Jig 9,500.00 19,000.00" - the real row is "... Jig 2 9,500.00
  // 19,000.00") still ends with the unit-price and amount columns, and
  // amount / unit = qty exactly. Only trusted when the division comes out
  // (near-)integer.
  const unitAmount = cleaned.match(
    /(?<![\d,.])(\d{1,3}(?:,\d{3})*\.\d{2})\s+(\d{1,3}(?:,\d{3})*\.\d{2})\s*$/,
  );
  if (unitAmount) {
    const unit = parseFloat(unitAmount[1].replace(/,/g, ""));
    const amount = parseFloat(unitAmount[2].replace(/,/g, ""));
    if (unit > 0 && amount >= unit) {
      const ratio = amount / unit;
      if (Math.abs(ratio - Math.round(ratio)) < 0.01 && Math.round(ratio) <= 9999) {
        return { qty: Math.round(ratio), price: formatPriceValue(unit) };
      }
    }
  }

  // Last resort for rows whose unit-price column got a character mangled by
  // OCR (e.g. "9900.00000" read as "$900.00000", which no longer parses as
  // a number): the qty columns and the trailing extended-amount column are
  // usually still clean, and unit price = extended amount / qty exactly.
  const qtyPrefix = line.match(
    new RegExp(`^(\\d+(?:\\.\\d+)?)\\s+\\d+(?:\\.\\d+)?\\s+(?:${DATE_FRAGMENT})\\s+(?:${DATE_FRAGMENT})`, "i"),
  );
  // (?:^|\s) anchor + \d+ alternative: the extended column prints without
  // thousands separators ("9900.00", "118800.00"), so a bare \d{1,3} would
  // silently match only the last 3 digits.
  const extendedTail = line.match(/(?:^|\s)((?:\d{1,3}(?:,\d{3})+|\d+)\.\d{2})\s*$/);
  if (qtyPrefix && extendedTail) {
    const qtyNum = parseFloat(qtyPrefix[1]);
    const extNum = parseFloat(extendedTail[1].replace(/,/g, ""));
    if (qtyNum > 0 && qtyNum < 100000 && extNum > 0) {
      const qty = Math.round(qtyNum);

      // If the unit-price column is present but starts with a "$"-like
      // misread, the character is either EXTRA junk ("$9900.00000" for
      // 9900) or a REPLACED leading 9 ("$900.00000" for 9900). Both
      // candidates are tried and cross-checked against qty x unit ~ ext;
      // whichever reproduces the extended amount is the real unit price -
      // more precise than ext / qty, whose own last digits can be
      // OCR-noisy ("9900.60").
      const mangledUnit = line.match(/[$§](\d{2,6}\.\d{3,5})\b/);
      if (mangledUnit) {
        const candidates = [parseFloat(mangledUnit[1]), parseFloat("9" + mangledUnit[1])];
        let best: number | null = null;
        for (const cand of candidates) {
          const diff = Math.abs(cand * qty - extNum);
          if (diff <= Math.max(1, extNum * 0.05) && (best === null || diff < Math.abs(best * qty - extNum))) {
            best = cand;
          }
        }
        if (best !== null) return { qty, price: formatPriceValue(best) };
      }

      const unit = extNum / qty;
      return { qty, price: formatPriceValue(Math.floor(unit * 100) / 100) };
    }
  }
  // Katolec-style rows where the qty/amount columns were dropped by OCR
  // entirely and only the unit price survived at the end of the row
  // ("2 |PB SWISS TOOLS ... 2,535.00", "8 | ไฟฉายคาดหัว 200.00"): take the
  // price and leave qty for manual entry rather than guessing.
  const soloMoney = cleaned.match(/(?:^|\s)(\d{1,3}(?:,\d{3})+\.\d{2}|\d{2,6}\.\d{2})\s*$/);
  if (soloMoney) {
    return { price: formatPriceValue(parseFloat(soloMoney[1].replace(/,/g, ""))) };
  }
  return {};
}

function extractQtyPriceFromBlock(block: RowBlock): { qty?: number; price?: string } {
  const result: { qty?: number; price?: string } = {};
  for (const line of block.dataLines) {
    const found = extractQtyPriceFromLine(line);
    if (found.qty !== undefined && result.qty === undefined) result.qty = found.qty;
    if (found.price !== undefined && result.price === undefined) result.price = found.price;
    if (result.qty !== undefined && result.price !== undefined) break;
  }
  return result;
}

interface DocumentFields {
  customer?: string;
  po?: string;
  quote?: string;
  dueDate?: string;
  poDate?: string;
}

// `itemText` is the concatenated text of the pages line items are read
// from (PO pages); `fullText` additionally includes quotation/attachment
// pages. Labels/dates/PO number must come from the PO pages so a value on
// an attached quotation (its own issue date, its own delivery terms) can
// never override the PO's, but the PTW quotation *number* is legitimately
// allowed to come from an attached quotation page when the PO itself
// doesn't reference one.
function extractDocumentFields(
  itemText: string,
  fullText: string,
  quotationText: string,
  filename?: string,
): DocumentFields {
  const fields: DocumentFields = {};
  const normalized = itemText;

  const customer = extractCustomerName(normalized) || extractCustomerName(fullText);
  if (customer) fields.customer = customer;

  const po = matchFirst(normalized, [
    new RegExp(`(?:เลขที่เอกสาร|doc\\.?\\s*no\\.?|p\\s*\\/\\s*o\\s*no\\.?|po\\s*no\\.?|po\\s*number|purchase\\s*order\\s*no\\.?|po#)${GAP}([A-Za-z0-9\\-\\/]{2,30}?\\d[A-Za-z0-9\\-\\/]{0,10})`, "i"),
  ]);
  // Katolec PO numbers are always "KAT-G____"; when the label matched but
  // OCR shredded the value ("P/O NO. : ๕ 47-600942" for KAT-G0942), the
  // last four digits on the P/O line are still reliable enough to rebuild
  // the number. Only applied for the known Katolec customer.
  let poRepaired: string | null = null;
  if (!po && fields.customer === "Katolec (THAILAND) CO., LTD.") {
    const poLine = normalized.match(/P\s*\/?\s*O\s*NO\.?[^\n]*?(\d{4})\s*~?\s*$/im);
    if (poLine) poRepaired = `KAT-G${poLine[1]}`;
  }

  const poFromFilename = po || poRepaired ? null : poNumberFromFilename(filename);
  if (po) fields.po = po;
  else if (poRepaired) fields.po = poRepaired;
  else if (poFromFilename) fields.po = poFromFilename;

  // On a PTW quotation page the "No." field IS the quotation number. It is
  // taken exactly as printed - some quotations print "PTW-2604012", others
  // just "2604021 Rev.1" - so no prefix is invented that isn't on paper.
  const quoteFromQuotationPage = (): string | null => {
    const m = quotationText.match(/(?:^|\s)No\.?\s*:?\s*((?:PTW\s*-\s*)?\d{7})\s*((?:REV|Rev)\.?\s*\d+)?/m);
    if (!m) return null;
    const num = m[1].replace(/\s+/g, "");
    const rev = m[2] ? ` ${m[2].replace(/\s+/g, "")}` : "";
    return `${num}${rev}`;
  };

  const quotePtwPattern =
    normalized.match(/PTW-\d{5,}(?:\s+REV\.?\s*\d+)?/i) ||
    fullText.match(/PTW-\d{5,}(?:\s+REV\.?\s*\d+)?/i);
  const quote =
    quotePtwPattern?.[0] ||
    quoteFromQuotationPage() ||
    matchFirst(normalized, [
      new RegExp(`(?:เลขที่ใบเสนอราคา|ref\\.?\\s*quote\\s*no\\.?|quotation\\s*no\\.?|quote\\s*no\\.?|your\\s*quotation)${GAP}([A-Za-z0-9\\-\\/]{2,30})`, "i"),
    ]);
  if (quote) fields.quote = quote;

  const dueDateRaw = matchFirst(normalized, [
    new RegExp(`(?:delivery\\s*date|กำหนดส่งมอบ|กำหนดส่ง|requested\\s*date|due\\s*date)${GAP}(${DATE_FRAGMENT})`, "i"),
  ]);
  let dueDateIso = dueDateRaw ? normalizeFoundDate(dueDateRaw) : null;
  if (!dueDateIso) {
    dueDateIso = findDateNear(normalized, /delivery\s*date|requested\s*date|กำหนดส่งมอบ|กำหนดส่ง/i);
  }
  if (dueDateIso) fields.dueDate = dueDateIso;

  const poDateRaw = matchFirst(normalized, [
    new RegExp(`(?:วันที่เอกสาร|doc\\.?\\s*date|date\\s*to\\s*order|order\\s*date|po\\s*date|send\\s*date|วันที่ใบสั่งซื้อ)${GAP}(${DATE_FRAGMENT})`, "i"),
  ]);
  let poDateIso = poDateRaw ? normalizeFoundDate(poDateRaw) : null;
  if (!poDateIso) {
    poDateIso = findDateNear(normalized, /order\s*date|po\s*date|send\s*date|doc\.?\s*date|วันที่เอกสาร|วันที่ใบสั่งซื้อ/i);
  }
  if (poDateIso) fields.poDate = poDateIso;

  return fields;
}

// A page that is PTW's own quotation, scanned into the same file as the
// customer's PO (a very common practice: the PO is sent together with the
// quotation it references and sometimes a CAD drawing of the part). Only
// the PTW quotation number may be taken from such a page - its line items,
// dates and totals must NOT be keyed in as PO data.
const QUOTATION_PAGE_MARKER = /^[ \t]*QUOTATION[ \t]*$|we thank for your enquiry/im;

// A page that is irrelevant to job entry altogether, e.g. a technical /
// CAD drawing sheet attached behind the PO.
const IRRELEVANT_PAGE_MARKER =
  /unless otherwise specified|all dimensions? (?:are )?in mm\.?|tolerance block|denotes critical dimensions/i;

export function extractJobFieldsFromText(text: string, filename?: string): ParsedJobRow[] {
  const normalizedAll = text.replace(/\r/g, "");

  // extractTextFromPdf separates pages with "\f"; older callers/tests may
  // pass unseparated text, which is then treated as one page.
  const pages = normalizedAll.split("\f").map((p) => p.trim()).filter(Boolean);
  const itemPages = pages.filter(
    (p) => !QUOTATION_PAGE_MARKER.test(p) && !IRRELEVANT_PAGE_MARKER.test(p),
  );
  // If everything got classified away (e.g. the user uploaded a lone
  // quotation), fall back to scanning all pages rather than returning
  // nothing at all.
  const effectivePages = itemPages.length > 0 ? itemPages : pages;
  const itemText = effectivePages.join("\n");
  const quotationText = pages.filter((p) => QUOTATION_PAGE_MARKER.test(p)).join("\n");

  const doc = extractDocumentFields(itemText, normalizedAll, quotationText, filename);

  // Line items are extracted per page: each PO page carries its own table
  // header/letterhead, and per-page scanning keeps junk on one page (e.g.
  // an OCR'd drawing sheet) from derailing the table on another.
  const blocks: RowBlock[] = [];
  for (const page of effectivePages) {
    const lines = page.split("\n").map((l) => l.trim()).filter(Boolean);
    const logoName = extractShortLogoName(lines);

    // Try the trailing "Description:" sub-label style first (Benchmark):
    // it's a more specific signal than a bare "Description" column header,
    // which can appear as a substring of an otherwise label-style layout
    // (e.g. "Pos/ Seq Item Description Carrier") and would otherwise be
    // matched first and mislead the header-style scan.
    let pageBlocks = extractLabelStyleBlocks(lines, logoName);
    if (pageBlocks.length === 0) pageBlocks = extractHeaderStyleBlocks(lines, logoName);
    blocks.push(...pageBlocks);
  }

  // Desc-only salvage runs only when the WHOLE document yielded nothing -
  // a page with an empty item table (e.g. a terms page that repeats the
  // table header) must never generate a junk row when real items were
  // already found on another page.
  if (blocks.length === 0) {
    for (const page of effectivePages) {
      const lines = page.split("\n").map((l) => l.trim()).filter(Boolean);
      const logoName = extractShortLogoName(lines);
      const salvaged = extractHeaderStyleBlocks(lines, logoName, true);
      if (salvaged.length > 0) {
        blocks.push(...salvaged);
        break;
      }
    }
  }

  // Total safety net: if no item table could be detected at all, still
  // return one row with whatever document-level fields were found so the
  // import isn't a silent no-op - the UI will flag the missing item
  // fields for manual entry.
  if (blocks.length === 0) blocks.push({ descLines: [], dataLines: [] });

  return blocks.map((block) => {
    const fields: Partial<NewJobForm> = {};
    if (doc.customer) fields.customer = doc.customer;
    if (doc.po) fields.po = doc.po;
    if (doc.quote) fields.quote = doc.quote;
    if (doc.poDate) fields.poDate = doc.poDate;

    const desc = buildDescription(block);
    if (desc) fields.desc = desc;

    const { qty, price } = extractQtyPriceFromBlock(block);
    if (qty) fields.qty = qty;
    if (price) fields.price = price;

    fields.dueDate = block.dueDate || doc.dueDate || getTodayIso();
    if (!fields.poDate) fields.poDate = getTodayIso();

    const missingFields: string[] = [];
    if (!fields.customer) missingFields.push(FIELD_LABELS_TH.customer);
    if (!fields.desc) missingFields.push(FIELD_LABELS_TH.desc);
    if (!fields.qty) missingFields.push(FIELD_LABELS_TH.qty);
    if (!fields.po) missingFields.push(FIELD_LABELS_TH.po);
    if (!fields.quote) missingFields.push(FIELD_LABELS_TH.quote);
    if (!fields.price) missingFields.push(FIELD_LABELS_TH.price);
    if (!block.dueDate && !doc.dueDate) missingFields.push(FIELD_LABELS_TH.dueDate);
    if (!doc.poDate) missingFields.push(FIELD_LABELS_TH.poDate);

    return { fields, missingFields };
  });
}
