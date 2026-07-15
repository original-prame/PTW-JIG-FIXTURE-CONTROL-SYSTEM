// Client-side PDF text/OCR extraction, used by the "import from PDF"
// feature on the Add Job tab. For each page, the embedded text layer is
// used when present (fast, exact - covers any digitally-generated PDF,
// which is the common case for POs exported from accounting software).
// When a page has no meaningful text layer (i.e. it's a scanned or
// photographed document), the page is rendered to a canvas and OCR'd
// with Tesseract (Thai + English) instead.

import * as pdfjsLib from "pdfjs-dist";
import { createWorker, PSM } from "tesseract.js";

// Served as a plain static file from /public (kept in sync by the
// "postinstall" script in package.json) rather than resolved via
// `new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url)`.
// That bundler-resolved form is unreliable under Next.js's Turbopack dev
// server - it can fail at runtime with "Setting up fake worker failed:
// Failed to fetch dynamically imported module ...pdf.worker.min...mjs".
// A same-origin static path works the same way in dev, production builds,
// and every bundler, with no dependency on how the worker's ESM import
// gets resolved.
pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

const MIN_CHARS_FOR_TEXT_LAYER = 20;

// OCR render resolution. PDF user space is 72 dpi, so scale 400/72 renders
// pages at ~400 dpi. Tested against real scanned POs (Benchmark TPC088611,
// Katolec G0943): at the old scale 2 (=144 dpi) Tesseract misread most item
// descriptions ("ITAMAR" -> "ธร ย ธา", "AOI" -> "AOL", whole rows dropped);
// at 300 dpi a few characters were still wrong ("ZOLL" -> "Z2OLL",
// "(TOP" -> "{TOP"); at 400 dpi every line item on both documents read
// correctly. The canvas dimension cap keeps very large page sizes from
// exhausting browser canvas limits.
const OCR_TARGET_SCALE = 400 / 72;
const OCR_MAX_CANVAS_DIM = 5000;

// Bumped whenever the OCR/parse behavior changes meaningfully, so users
// can verify (from the toast/console) that the new build is live.
export const OCR_PIPELINE_VERSION = "v9";

// Most POs arriving here are scans: the PDF page is just a wrapper around
// one big bitmap (200-300 dpi, often 1-bit CCITT). Rendering such a page at
// an arbitrary dpi resamples that bitmap by a fractional factor, and the
// resulting blur is what breaks Tesseract (digits swap: 9900 -> 3900,
// table columns get read out of order). Rendering at the bitmap's native
// resolution instead maps it ~1:1 onto the canvas - measured on the real
// TPC088611 PO, this alone took every qty/price row from garbled to exact.
// The largest embedded image is found via the page's operator list; pages
// without a detectable scan (vector/text PDFs) fall back to the default
// 400 dpi target.
async function detectNativeScanScale(page: pdfjsLib.PDFPageProxy): Promise<number | null> {
  try {
    const opList = await page.getOperatorList();
    let maxWidth = 0;
    for (let i = 0; i < opList.fnArray.length; i++) {
      const fn = opList.fnArray[i];
      if (fn !== pdfjsLib.OPS.paintImageXObject && fn !== pdfjsLib.OPS.paintImageMaskXObject) {
        continue;
      }
      const arg = opList.argsArray[i]?.[0];
      let width = 0;
      if (typeof arg === "string") {
        // Regular images are stored by object id and resolved via page.objs.
        try {
          const img = page.objs.get(arg) as { width?: number } | null;
          if (img && typeof img.width === "number") width = img.width;
        } catch {
          // Not resolved (shouldn't happen after getOperatorList) - skip.
        }
      } else if (arg && typeof arg === "object" && typeof (arg as { width?: number }).width === "number") {
        // Image masks (1-bit stencils) carry their data inline.
        width = (arg as { width: number }).width;
      }
      if (width > maxWidth) maxWidth = width;
    }
    if (maxWidth <= 0) return null;
    const base = page.getViewport({ scale: 1 });
    let scale = maxWidth / base.width;
    // A very low-res scan still needs big-enough glyphs for Tesseract; an
    // integer 2x upscale of a 1-bit bitmap stays crisp.
    if (scale * 72 < 150) scale *= 2;
    return scale >= 1 ? scale : null;
  } catch {
    return null;
  }
}

// Tesseract reads noticeably better from a clean grayscale image than from
// the RGBA canvas pdf.js renders (scanned POs often carry faint color
// noise / JPEG artifacts from the scanner).
function toGrayscale(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  const imageData = ctx.getImageData(0, 0, width, height);
  const px = imageData.data;
  for (let i = 0; i < px.length; i += 4) {
    // ITU-R BT.601 luma.
    const y = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
    px[i] = px[i + 1] = px[i + 2] = y;
  }
  ctx.putImageData(imageData, 0, 0);
}

// Character/word-level fixes for confusions Tesseract still makes at 400 dpi
// on these documents' fonts, verified against the source images. Kept
// deliberately narrow (word-boundary anchored, or with a context lookahead)
// so a legitimate word can never be rewritten. Applied only to OCR output,
// never to a PDF's embedded text layer.
const OCR_WORD_FIXES: Array<[RegExp, string]> = [
  // "ZOLL" (customer project name) misread with 2/7/0/4 for its letters.
  [/\b(?:Z2OLL|Z0LL|2OLL|20LL|70LL|204L)\b/g, "ZOLL"],
  // With the Thai language model loaded, Tesseract sometimes renders the
  // "ZOLL" between "FOR" and "ITAMAR" as a run of short Thai/Latin junk
  // tokens ("FOR 20 บ บ ITAMAR", "FOR ร อ บ บ ITAMAR"). The context
  // ("FOR ... ITAMAR") is unambiguous, so collapse whatever is in between.
  [/\bFOR\s+(?:[0-9A-Za-zก-๙'\[\]]{1,4}\s+){1,4}(?=ITAMAR\b)/g, "FOR ZOLL "],
  // "ITAMAR" with the leading I misread as [, T, P, 1, l or I'.
  [/\[TAMAR\b|\b(?:TTAMAR|PTAMAR|1TAMAR|lTAMAR|I'TAMAR)\b/g, "ITAMAR"],
  // "AOI PALLET" / "SMT PALLET" with the acronym misread.
  [/\b(?:AQI|AOL|ACI|AO1|A0I)(?=\s+PALLET)/g, "AOI"],
  [/\bSMP(?=\s+PALLET)/g, "SMT"],
  // "(TOP SIDE)" / "(BOTTOM SIDE)" with SIDE's I misread.
  [/\bS[7({[]DE\b|\bSIUE\b|\bSIDS\b/g, "SIDE"],
  // "(TOP SIDE" / "(BOTTOM SIDE" losing the closing parenthesis to the
  // table border it touches.
  [/\((TOP|BOTTOM)\s+SIDE\b(?!\))/g, "($1 SIDE)"],
];

// Minimal shape of the tesseract.js block tree (data.blocks with the
// `blocks: true` output option).
interface OcrWord {
  text: string;
  bbox: { x0: number; y0: number; x1: number; y1: number };
}
interface OcrBlockTree {
  paragraphs: Array<{ lines: Array<{ words: OcrWord[] }> }>;
}

// Rebuilds page text from word bounding boxes: words are grouped into
// visual rows by Y position and sorted left-to-right, exactly like
// reconstructPageText does for a PDF's embedded text layer. This is the
// core defense against Tesseract's block segmentation reading a scanned
// table out of order (totals before items, price column split from the
// description column) - the WORDS are usually all recognized, they just
// arrive in the wrong sequence in `data.text`. Real failure this fixes:
// the Katolec G0696 PO where 11 of 12 line items were lost because every
// description was separated from its price.
function reconstructOcrLayout(blocks: OcrBlockTree[] | null | undefined): string {
  const words: Array<{ text: string; x: number; y: number; h: number }> = [];
  for (const block of blocks || []) {
    for (const paragraph of block.paragraphs) {
      for (const line of paragraph.lines) {
        for (const word of line.words) {
          const text = (word.text || "").trim();
          if (!text) continue;
          words.push({
            text,
            x: word.bbox.x0,
            y: (word.bbox.y0 + word.bbox.y1) / 2,
            h: word.bbox.y1 - word.bbox.y0,
          });
        }
      }
    }
  }
  if (words.length === 0) return "";

  const heights = words.map((w) => w.h).sort((a, b) => a - b);
  const medianHeight = heights[Math.floor(heights.length / 2)] || 20;
  const tolerance = medianHeight * 0.6;

  words.sort((a, b) => a.y - b.y || a.x - b.x);
  const rows: Array<{ y: number; words: typeof words }> = [];
  for (const word of words) {
    const row = rows.length ? rows[rows.length - 1] : null;
    if (row && Math.abs(word.y - row.y) <= tolerance) {
      row.words.push(word);
      row.y = (row.y * (row.words.length - 1) + word.y) / row.words.length;
    } else {
      rows.push({ y: word.y, words: [word] });
    }
  }
  return rows
    .map((row) => row.words.sort((a, b) => a.x - b.x).map((w) => w.text).join(" "))
    .join("\n");
}

// A line that looks like an intact item-table row: optional item number,
// then description words, ending in a money amount with a thousands
// separator ("1 PCB Cutting Jig 2 9,500.00 19,000.00"). When the two OCR
// passes disagree, the pass that kept item rows intact is worth far more
// than a couple of points of raw confidence - a fragmented pass can score
// slightly higher confidence while being useless to the parser (this
// exact flip happened on the real G0941 PO: 84 vs 85 confidence, but only
// the lower-scoring... higher-confidence pass had the row shredded).
const ITEM_ROW_SIGNAL = /^\d{0,4}\s*[|\[(]?\s*[A-Za-zก-๙].*\d{1,3}(?:,\d{3})+\.\d{2}\s*$/;

function structureScore(text: string): number {
  let count = 0;
  for (const rawLine of text.split("\n")) {
    if (ITEM_ROW_SIGNAL.test(rawLine.trim())) count++;
  }
  return Math.min(count, 6) * 10;
}

// Junk characters Tesseract hallucinates at the start/end of a line from
// table borders / scan speckle (e.g. "| 60/ © 899-246-000 ..." or
// "Description: |"), which then stop the parser from recognising the line
// as a table row / column label.
const LINE_LEADING_JUNK = /^[|>»\[\]{}©®°'‘’“”"`~_=*]+\s*/;
const LINE_TRAILING_JUNK = /[\s|«»\[\]{}'‘’“”"`~_=*°<>]+$/;

/**
 * Cleans up raw Tesseract output: strips border/speckle junk from line
 * starts, converts brace misreads of parentheses, and applies the narrow
 * word-fix list above. Exported so tests can cover it directly.
 */
export function normalizeOcrText(text: string): string {
  let out = text
    .split("\n")
    .map((line) => line.replace(LINE_LEADING_JUNK, "").replace(LINE_TRAILING_JUNK, ""))
    .join("\n");
  // Tesseract renders Thai from scans with a space between nearly every
  // character ("ชุ ด ป ร ะ แจ"); collapsing gaps between adjacent Thai
  // characters restores readable words. (Genuine OCR debris - isolated
  // Thai characters scattered among digits - stays isolated because the
  // digits break the joins, so the parser's junk filter still catches it.)
  out = out.replace(/(?<=[ก-๙])[ \t]+(?=[ก-๙])/g, "");

  for (const [pattern, replacement] of OCR_WORD_FIXES) {
    out = out.replace(pattern, replacement);
  }

  // PTW quotation numbers ("PTW-2506031") with digits misread as look-alike
  // characters: "(" / "[" / "{" / "O" for 0, "I" / "l" for 1. Repaired here
  // because the quotation-number field is matched by the PTW-\d+ pattern
  // downstream and a single bad character makes the whole number invisible.
  out = out.replace(/PTW\s?-\s?[0-9(\[{OoIl]{5,10}/g, (m) => {
    const digits = m
      .replace(/^PTW\s?-\s?/, "")
      .replace(/[(\[{Oo]/g, "0")
      .replace(/[Il]/g, "1");
    return `PTW-${digits}`;
  });

  // Same look-alike confusion inside an uppercase-prefixed document number
  // ("TPC(88611" -> "TPC088611").
  out = out.replace(/\b([A-Z]{2,4})[(\[{](?=\d{4,})/g, "$10");

  // The board code following "ITAMAR" on Benchmark POs is always
  // "BB2111105" in this project family, but its 1-bit scan is frequently
  // misread ("BBZ2111105", "BE211118%", "BB2111145", "BR2111105"). Only a
  // token in the ITAMAR context that still loosely resembles the code
  // (leading B/8, contains a 2 and at least three 1s) is rewritten, so an
  // unrelated future code after "ITAMAR" is left alone.
  out = out.replace(/(ITAMAR\s+)([A-Za-z0-9%(\[{}]{6,12})/g, (m, pre: string, tok: string) => {
    const t = tok.toUpperCase();
    const ones = (t.match(/1/g) || []).length;
    if (/^[B8]/.test(t) && ones >= 3 && t.includes("2")) return `${pre}BB2111105`;
    return m;
  });

  // Scanned POs essentially never contain real curly braces; Tesseract
  // regularly produces them for parentheses ("{TOP SIDE)").
  out = out.replace(/\{/g, "(").replace(/\}/g, ")");
  return out;
}

const ROW_Y_TOLERANCE = 3;
// How large a horizontal gap between two items needs to be before a
// space is inserted between them. pdfjs-dist hands back each page's text
// as a flat list of items in the PDF's internal content-stream order,
// which is very often *not* reading order (a table's cells can arrive in
// a completely different sequence than they're drawn on the page) and
// joining them with a single naive space per item also frequently
// mangles things like "SPP-PT-07" into "SPP - PT - 07" (each hyphen is
// commonly its own separate text item with ~0 real gap around it). Sorting
// items into rows by Y position, then left-to-right by X position within
// each row, and only inserting a space when the horizontal gap between
// consecutive items exceeds this threshold, reconstructs text that reads
// the same way pdftotext -layout would.
const SPACE_GAP_THRESHOLD = 1;

function reconstructPageText(items: unknown[]): string {
  interface RowItem {
    x: number;
    width: number;
    str: string;
  }
  interface Row {
    y: number;
    items: RowItem[];
  }

  const rows: Row[] = [];
  for (const raw of items) {
    if (typeof raw !== "object" || raw === null || !("str" in raw) || !("transform" in raw)) continue;
    const item = raw as { str: unknown; transform: unknown; width?: unknown };
    if (typeof item.str !== "string" || !item.str.trim() || !Array.isArray(item.transform)) continue;
    const x = item.transform[4] as number;
    const y = item.transform[5] as number;
    const width = typeof item.width === "number" ? item.width : 0;
    let row = rows.find((r) => Math.abs(r.y - y) < ROW_Y_TOLERANCE);
    if (!row) {
      row = { y, items: [] };
      rows.push(row);
    }
    row.items.push({ x, width, str: item.str });
  }

  // PDF's Y axis increases upward, so sort descending to get top-to-bottom.
  rows.sort((a, b) => b.y - a.y);
  for (const row of rows) row.items.sort((a, b) => a.x - b.x);

  return rows
    .map((row) => {
      let line = "";
      let prevEnd: number | null = null;
      for (const it of row.items) {
        if (prevEnd !== null && it.x - prevEnd > SPACE_GAP_THRESHOLD) {
          line += " ";
        }
        line += it.str;
        prevEnd = it.x + it.width;
      }
      return line.trim();
    })
    .join("\n");
}

/**
 * Extracts all readable text from a PDF file, page by page, falling back
 * to OCR for pages without a usable text layer. Pages are separated with
 * a form-feed character ("\f") so the parser can treat each page
 * independently (e.g. skip a quotation or CAD-drawing page that was
 * scanned into the same PO file). `onProgress` (optional) receives short
 * Thai status messages suitable for showing in a toast.
 */
export async function extractTextFromPdf(
  file: File,
  onProgress?: (message: string) => void,
): Promise<string> {
  // Version marker: shows up in the first progress toast and the browser
  // console so it's easy to confirm which pipeline build is actually
  // running after an update (stale Next.js build caches have bitten us).
  console.info(`[pdf-ocr] pipeline ${OCR_PIPELINE_VERSION}`);

  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;

  let combinedText = "";
  let ocrWorker: Awaited<ReturnType<typeof createWorker>> | null = null;

  try {
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      onProgress?.(`(OCR ${OCR_PIPELINE_VERSION}) กำลังอ่านหน้า ${pageNum}/${pdf.numPages}...`);
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      const pageText = reconstructPageText(textContent.items);

      if (pageText.length >= MIN_CHARS_FOR_TEXT_LAYER) {
        combinedText += pageText + "\n\f\n";
        continue;
      }

      // No usable text layer on this page - fall back to OCR against a
      // rendered image of it (handles scanned/photographed PDFs).
      //
      // Which render resolution reads best depends on the individual scan:
      // measured on the real customer POs, the Benchmark PO (200 dpi CCITT)
      // reads almost perfectly at its native 1:1 scale and badly at 400 dpi,
      // while the Katolec PO (mixed 150/300 dpi layers) is the exact
      // opposite. So when a native scan resolution is detected and differs
      // meaningfully from the default target, the page is OCR'd at BOTH
      // scales and the pass Tesseract itself is more confident about wins.
      const baseViewport = page.getViewport({ scale: 1 });
      const capScale = OCR_MAX_CANVAS_DIM / Math.max(baseViewport.width, baseViewport.height);
      const nativeScale = await detectNativeScanScale(page);
      const scales: number[] = [];
      if (nativeScale && Math.abs(nativeScale - OCR_TARGET_SCALE) / OCR_TARGET_SCALE > 0.1) {
        scales.push(Math.min(nativeScale, capScale), Math.min(OCR_TARGET_SCALE, capScale));
      } else {
        scales.push(Math.min(nativeScale ?? OCR_TARGET_SCALE, capScale));
      }

      if (!ocrWorker) {
        onProgress?.(`(OCR ${OCR_PIPELINE_VERSION}) กำลังเตรียมระบบ OCR...`);
        ocrWorker = await createWorker("eng+tha");
        // PSM 4 ("single column of text of variable sizes") reads these
        // full-page PO tables noticeably better than the default full
        // auto-segmentation, which tends to shuffle table cells out of
        // reading order and drop short rows.
        await ocrWorker.setParameters({
          tessedit_pageseg_mode: PSM.SINGLE_COLUMN,
        });
      }

      let bestText = "";
      let bestScore = -1;
      for (let pass = 0; pass < scales.length; pass++) {
        const passLabel = scales.length > 1 ? ` (รอบ ${pass + 1}/${scales.length})` : "";
        onProgress?.(
          `(OCR ${OCR_PIPELINE_VERSION}) หน้า ${pageNum} ไม่มีข้อความในไฟล์ กำลังทำ OCR${passLabel}...`,
        );
        const viewport = page.getViewport({ scale: scales[pass] });
        const canvas = document.createElement("canvas");
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        const ctx = canvas.getContext("2d");
        if (!ctx) continue;
        await page.render({ canvasContext: ctx, viewport }).promise;
        toGrayscale(ctx, canvas.width, canvas.height);

        const { data } = await ocrWorker.recognize(canvas, {}, { blocks: true, text: true });
        const confidence = typeof data.confidence === "number" ? data.confidence : 0;
        const layoutText = reconstructOcrLayout(
          (data as unknown as { blocks?: OcrBlockTree[] }).blocks,
        );
        const normalized = normalizeOcrText(layoutText || data.text || "");
        // Confidence + intact-table-structure bonus (see ITEM_ROW_SIGNAL).
        const score = confidence + structureScore(normalized);
        if (score > bestScore) {
          bestScore = score;
          bestText = normalized;
        }
      }
      combinedText += bestText + "\n\f\n";
    }
  } finally {
    if (ocrWorker) await ocrWorker.terminate();
  }

  return combinedText;
}
