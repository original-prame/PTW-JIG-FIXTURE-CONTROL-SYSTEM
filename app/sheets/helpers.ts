import { google, sheets_v4 } from "googleapis";
import path from "path";

export const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID;

export const PRODUCTION_SHEET = "Production_Jobs";
export const DELIVERY_SHEET = "Delivery_Log";
export const SETTINGS_SHEET = "Settings";
export const CUSTOMERS_SHEET = "Customers";
export const USERS_SHEET = "Users";

/**
 * Column letters for each editable production-job field, keyed by the
 * `JobData` property name. Centralizing this mapping means every action
 * that edits a job (UPDATE_STATUS, UPDATE_JOB) reads from one place
 * instead of re-declaring its own copy.
 */
export const PRODUCTION_STATUS_COLUMNS: Record<string, string> = {
  Status_Drawing: "I",
  Status_Mat: "J",
  Status_CNC: "K",
  Status_Milling: "L",
  Status_Assembly: "M",
};

/**
 * Resolves Google service-account credentials. Tries, in order:
 *  1. GOOGLE_CREDENTIALS_JSON - the full service-account JSON as a string
 *     (e.g. set directly in Vercel/host env vars).
 *  2. GOOGLE_APPLICATION_CREDENTIALS - a path to a key file on disk,
 *     handled automatically by google-auth-library when neither
 *     `keyFile` nor `credentials` is passed explicitly.
 *  3. A local key file, named by GOOGLE_CREDENTIALS_FILE (defaults to
 *     "google-credentials.json") and resolved relative to the project
 *     root. Convenient for local dev - just drop the key file in the
 *     project root - but make sure that filename stays in .gitignore.
 */
function resolveGoogleAuth() {
  const rawJson = process.env.GOOGLE_CREDENTIALS_JSON;
  if (rawJson) {
    let credentials: Record<string, unknown>;
    try {
      credentials = JSON.parse(rawJson);
    } catch {
      throw new Error(
        "GOOGLE_CREDENTIALS_JSON is set but is not valid JSON. Check the environment variable value.",
      );
    }
    return new google.auth.GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
  }

  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    // google-auth-library reads this env var itself when no keyFile/credentials given.
    return new google.auth.GoogleAuth({
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
  }

  const keyFileName = process.env.GOOGLE_CREDENTIALS_FILE || "google-credentials.json";
  return new google.auth.GoogleAuth({
    // turbopackIgnore: this dynamic path is a local-dev convenience only
    // (drop a key file in the project root); it must not pull the whole
    // project into the serverless function's file trace.
    keyFile: path.join(/* turbopackIgnore: true */ process.cwd(), keyFileName),
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
}

export async function getSheetsInstance() {
  const auth = resolveGoogleAuth();
  const client = await auth.getClient();
  return google.sheets({ version: "v4", auth: client as never });
}

export class NotFoundError extends Error {}

export class BadRequestError extends Error {}

/** Validates that a request field is a non-empty string, throwing BadRequestError otherwise. */
export function requireString(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new BadRequestError(`ข้อมูล "${fieldName}" ไม่ถูกต้องหรือขาดหายไป`);
  }
  return value;
}

/**
 * Finds the row for `id` in column A of `sheetName` (searched against the
 * full column, header included) and returns both the 1-based row number
 * (for `Sheet!C5`-style range strings) and the 0-based row index (for
 * `deleteDimension` requests, which are 0-based). Throws NotFoundError
 * when no row matches.
 */
export async function findRowByFirstColumn(
  sheets: sheets_v4.Sheets,
  sheetName: string,
  id: string,
  notFoundMessage: string,
): Promise<{ rowNumber1Based: number; rowIndex0Based: number }> {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A1:A`,
  });
  const rows = res.data.values || [];
  const rowIndex0Based = rows.findIndex((r) => r[0] === id);

  // Index 0 is the header row, so anything below 1 means "not found".
  if (rowIndex0Based < 1) throw new NotFoundError(notFoundMessage);

  return { rowNumber1Based: rowIndex0Based + 1, rowIndex0Based };
}

/** Writes a set of single-cell updates (column letter + row number -> value) sequentially. */
export async function updateCells(
  sheets: sheets_v4.Sheets,
  sheetName: string,
  rowNumber1Based: number,
  updates: { column: string; value: unknown }[],
) {
  for (const { column, value } of updates) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!${column}${rowNumber1Based}`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [[value]] },
    });
  }
}

/**
 * Ensures a sheet (tab) with the given title exists in the spreadsheet,
 * creating it (with an optional header row) when missing. Used by the
 * Customers sheet so the feature works even on spreadsheets created
 * before that tab was introduced.
 */
export async function ensureSheetExists(
  sheets: sheets_v4.Sheets,
  sheetName: string,
  headerRow?: string[],
) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const exists = meta.data.sheets?.some((s) => s.properties?.title === sheetName);
  if (exists) return;

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: { requests: [{ addSheet: { properties: { title: sheetName } } }] },
  });
  if (headerRow && headerRow.length > 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!A1`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [headerRow] },
    });
  }
}

/** Deletes a single row from `sheetName` given its 0-based row index. */
export async function deleteRow(
  sheets: sheets_v4.Sheets,
  sheetName: string,
  rowIndex0Based: number,
) {
  const sheetMetadata = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const targetSheet = sheetMetadata.data.sheets?.find((s) => s.properties?.title === sheetName);
  const sheetId = targetSheet?.properties?.sheetId;

  if (sheetId === undefined) throw new Error(`ไม่พบแผ่นงานชื่อ ${sheetName} บน Google Sheets`);

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId,
              dimension: "ROWS",
              startIndex: rowIndex0Based,
              endIndex: rowIndex0Based + 1,
            },
          },
        },
      ],
    },
  });
}
