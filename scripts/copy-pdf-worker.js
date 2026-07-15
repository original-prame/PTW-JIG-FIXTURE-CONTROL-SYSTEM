// Copies the pdfjs-dist PDF.js worker into /public so it can be served as
// a same-origin static file (see lib/pdf-ocr.ts for why). Runs
// automatically after every `npm install` via the "postinstall" script.
/* eslint-disable @typescript-eslint/no-require-imports -- plain CommonJS
   Node script invoked directly via `node`, not part of the app bundle. */
const fs = require("fs");
const path = require("path");

const src = path.join(
  __dirname,
  "..",
  "node_modules",
  "pdfjs-dist",
  "build",
  "pdf.worker.min.mjs",
);
const dest = path.join(__dirname, "..", "public", "pdf.worker.min.mjs");

if (!fs.existsSync(src)) {
  console.warn("[copy-pdf-worker] pdfjs-dist worker not found at", src, "- skipping.");
  process.exit(0);
}

fs.copyFileSync(src, dest);
console.log("[copy-pdf-worker] Copied pdf.worker.min.mjs to public/");
