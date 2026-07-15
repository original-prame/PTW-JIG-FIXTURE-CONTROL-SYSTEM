import { NextResponse } from "next/server";
import { sheets_v4 } from "googleapis";
import { JobData, DeliveryData } from "@/app/types";
import {
  getSheetsInstance,
  findRowByFirstColumn,
  updateCells,
  deleteRow,
  requireString,
  BadRequestError,
  ensureSheetExists,
  SPREADSHEET_ID,
  PRODUCTION_SHEET,
  DELIVERY_SHEET,
  SETTINGS_SHEET,
  CUSTOMERS_SHEET,
  PRODUCTION_STATUS_COLUMNS,
} from "./helpers";

export type { JobData, DeliveryData };

export async function GET() {
  try {
    const sheets = await getSheetsInstance();

    const [prodRes, delivRes, settingsRes, customersRes] = await Promise.all([
      sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${PRODUCTION_SHEET}!A2:P`,
      }),
      sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${DELIVERY_SHEET}!A2:G`,
      }),
      sheets.spreadsheets.values
        .get({ spreadsheetId: SPREADSHEET_ID, range: `${SETTINGS_SHEET}!A2:B` })
        .catch(() => ({ data: { values: [] } })),
      // The Customers sheet may not exist yet on older spreadsheets - treat
      // that the same as "no saved customers".
      sheets.spreadsheets.values
        .get({ spreadsheetId: SPREADSHEET_ID, range: `${CUSTOMERS_SHEET}!A2:A` })
        .catch(() => ({ data: { values: [] } })),
    ]);

    const prodRows = prodRes.data.values || [];
    const delivRows = delivRes.data.values || [];
    const settingsRows = settingsRes.data.values || [];
    const customers = (customersRes.data.values || [])
      .map((row) => (row[0] || "").toString().trim())
      .filter(Boolean);

    let urgentDaysConfig = 5;
    const urgentConfig = settingsRows.find((row) => row[0] === "urgent_deliveries_days");
    if (urgentConfig && urgentConfig[1]) {
      const parsedValue = parseInt(urgentConfig[1], 10);
      if (!isNaN(parsedValue)) urgentDaysConfig = parsedValue;
    }

    const jobs: JobData[] = prodRows.map((row) => ({
      Job_ID: row[0] || "",
      Release_Date: row[1] || "",
      Job_Description: row[2] || "",
      Qty: row[3] || "0",
      Customer: row[4] || "",
      PO: row[5] || "",
      Quotation: row[6] || "",
      Due_Date: row[7] || "",
      Status_Drawing: row[8] || "Waiting",
      Status_Mat: row[9] || "Waiting",
      Status_CNC: row[10] || "Waiting",
      Status_Milling: row[11] || "Waiting",
      Status_Assembly: row[12] || "Waiting",
      Remark: row[13] || "",
      Price: row[14] || "",
      PO_Date: row[15] || "",
    }));

    const deliveries: DeliveryData[] = delivRows.map((row) => ({
      Delivery_ID: row[0] || "",
      Job_ID: row[1] || "",
      Delivery_Date: row[2] || "",
      Delivery_Note_No: row[3] || "",
      Delivery_Qty: row[4] || "0",
      Invoice_No: row[5] || "",
      Remark: row[6] || "",
    }));

    const combinedData: JobData[] = jobs.map((job) => {
      const jobDeliveries = deliveries.filter((d) => d.Job_ID === job.Job_ID);
      const totalDeliveredQty = jobDeliveries.reduce(
        (sum, d) => sum + (parseInt(d.Delivery_Qty) || 0),
        0,
      );
      const latestDelivery = jobDeliveries[jobDeliveries.length - 1] || null;

      return {
        ...job,
        delivered_qty_total: totalDeliveredQty,
        delivery: latestDelivery,
      };
    });

    return NextResponse.json({
      success: true,
      data: combinedData,
      deliveryLogs: deliveries,
      urgentDays: urgentDaysConfig,
      customers,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

type ActionBody = Record<string, string | number | undefined>;

type ActionHandler = (sheets: sheets_v4.Sheets, body: ActionBody) => Promise<Response>;

async function addJob(sheets: sheets_v4.Sheets, body: ActionBody) {
  const jobId = `PTW-${Date.now().toString().slice(-6)}`;
  const today = new Date().toLocaleDateString("th-TH");
  const { desc, qty, customer, po, quote, dueDate, remark, price, poDate } = body;

  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${PRODUCTION_SHEET}!A2`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [
        [jobId, today, desc, qty, customer, po, quote, dueDate, "Waiting", "Waiting", "Waiting", "Waiting", "Waiting", remark, price, poDate],
      ],
    },
  });
  return NextResponse.json({ success: true, jobId });
}

async function updateStatus(sheets: sheets_v4.Sheets, body: ActionBody) {
  const jobId = requireString(body.jobId, "jobId");
  const column = requireString(body.column, "column");
  const { newValue } = body;
  const columnLetter = PRODUCTION_STATUS_COLUMNS[column];
  if (!columnLetter) throw new BadRequestError(`คอลัมน์สถานะไม่ถูกต้อง: ${column}`);

  const { rowNumber1Based } = await findRowByFirstColumn(
    sheets,
    PRODUCTION_SHEET,
    jobId,
    "ไม่พบรหัส Job ID นี้ในระบบ",
  );

  await updateCells(sheets, PRODUCTION_SHEET, rowNumber1Based, [{ column: columnLetter, value: newValue }]);
  return NextResponse.json({ success: true });
}

async function updateJob(sheets: sheets_v4.Sheets, body: ActionBody) {
  const jobId = requireString(body.jobId, "jobId");
  const { customer, desc, qty, dueDate, po, quote, remark, price, poDate } = body;

  const { rowNumber1Based } = await findRowByFirstColumn(
    sheets,
    PRODUCTION_SHEET,
    jobId,
    "ไม่พบรหัส Job ID ที่ต้องการแก้ไขในระบบ",
  );

  await updateCells(sheets, PRODUCTION_SHEET, rowNumber1Based, [
    { column: "C", value: desc },
    { column: "D", value: qty },
    { column: "E", value: customer },
    { column: "F", value: po },
    { column: "G", value: quote },
    { column: "H", value: dueDate },
    { column: "N", value: remark },
    { column: "O", value: price },
    { column: "P", value: poDate },
  ]);
  return NextResponse.json({ success: true });
}

async function deleteJob(sheets: sheets_v4.Sheets, body: ActionBody) {
  const jobId = requireString(body.jobId, "jobId");
  const { rowIndex0Based } = await findRowByFirstColumn(
    sheets,
    PRODUCTION_SHEET,
    jobId,
    "ไม่พบรหัส Job ID ที่ต้องการลบในระบบ",
  );
  await deleteRow(sheets, PRODUCTION_SHEET, rowIndex0Based);
  return NextResponse.json({ success: true });
}

async function deliverJob(sheets: sheets_v4.Sheets, body: ActionBody) {
  const delivId = `DLV-${Date.now().toString().slice(-5)}`;
  const { jobId, delivDate, noteNo, delivQty, invoiceNo, remark } = body;

  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${DELIVERY_SHEET}!A2`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [[delivId, jobId, delivDate, noteNo, delivQty, invoiceNo, remark]],
    },
  });
  return NextResponse.json({ success: true });
}

async function updateDelivery(sheets: sheets_v4.Sheets, body: ActionBody) {
  const delivId = requireString(body.delivId, "delivId");
  const { delivDate, noteNo, delivQty, invoiceNo, remark } = body;
  const { rowNumber1Based } = await findRowByFirstColumn(
    sheets,
    DELIVERY_SHEET,
    delivId,
    "ไม่พบรหัสประวัติจัดส่งที่ต้องการแก้ไข",
  );

  await updateCells(sheets, DELIVERY_SHEET, rowNumber1Based, [
    { column: "C", value: delivDate },
    { column: "D", value: noteNo },
    { column: "E", value: delivQty },
    { column: "F", value: invoiceNo },
    { column: "G", value: remark },
  ]);
  return NextResponse.json({ success: true });
}

async function deleteDelivery(sheets: sheets_v4.Sheets, body: ActionBody) {
  const delivId = requireString(body.delivId, "delivId");
  const { rowIndex0Based } = await findRowByFirstColumn(
    sheets,
    DELIVERY_SHEET,
    delivId,
    "ไม่พบรหัสประวัติจัดส่งที่ต้องการลบ",
  );
  await deleteRow(sheets, DELIVERY_SHEET, rowIndex0Based);
  return NextResponse.json({ success: true });
}

// Persists a manually added customer name into the Customers sheet so it
// survives page reloads and is shared by everyone using the sheet (the
// customer dropdown previously only kept new names in browser memory).
// Duplicate names (case-insensitive) are treated as success so the UI
// doesn't error when two people add the same customer.
async function addCustomer(sheets: sheets_v4.Sheets, body: ActionBody) {
  const name = requireString(body.name, "name").trim();

  await ensureSheetExists(sheets, CUSTOMERS_SHEET, ["Customer_Name", "Added_Date"]);

  const existingRes = await sheets.spreadsheets.values
    .get({ spreadsheetId: SPREADSHEET_ID, range: `${CUSTOMERS_SHEET}!A2:A` })
    .catch(() => ({ data: { values: [] as string[][] } }));
  const existing = (existingRes.data.values || []).map((r) => (r[0] || "").toString().trim().toLowerCase());
  if (existing.includes(name.toLowerCase())) {
    return NextResponse.json({ success: true, alreadyExists: true });
  }

  const today = new Date().toLocaleDateString("th-TH");
  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${CUSTOMERS_SHEET}!A2`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [[name, today]] },
  });
  return NextResponse.json({ success: true });
}

const ACTIONS: Record<string, ActionHandler> = {
  ADD_JOB: addJob,
  ADD_CUSTOMER: addCustomer,
  UPDATE_STATUS: updateStatus,
  UPDATE_JOB: updateJob,
  DELETE_JOB: deleteJob,
  DELIVER_JOB: deliverJob,
  UPDATE_DELIVERY: updateDelivery,
  DELETE_DELIVERY: deleteDelivery,
};

export async function POST(request: Request) {
  try {
    const sheets = await getSheetsInstance();
    const body = (await request.json()) as ActionBody & { action: string };
    const { action } = body;

    const handler = ACTIONS[action];
    if (!handler) {
      return NextResponse.json({ success: false, error: "Invalid Action" }, { status: 400 });
    }

    return await handler(sheets, body);
  } catch (error: unknown) {
    // Matches the original API's behavior of always responding 500 with
    // `{ success: false, error: <message> }`, regardless of error type,
    // so existing frontend error handling (which reads err.message) keeps
    // working unchanged.
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
