import { NextResponse } from "next/server";
import {
  getSheetsInstance,
  ensureSheetExists,
  SPREADSHEET_ID,
  USERS_SHEET,
} from "@/app/sheets/helpers";
import {
  createSessionToken,
  SESSION_COOKIE,
  USER_DISPLAY_COOKIE,
  SESSION_MAX_AGE_SECONDS,
} from "@/lib/auth";

// POST { username, password } -> validates against the Users sheet and sets
// the session cookies. The Users sheet is created on first use with a
// default "admin" account so the very first login is possible - change that
// password in the sheet right away.
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { username?: unknown; password?: unknown };
    const username = typeof body.username === "string" ? body.username.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";
    if (!username || !password) {
      return NextResponse.json(
        { success: false, error: "กรุณากรอกชื่อผู้ใช้และรหัสผ่าน" },
        { status: 400 },
      );
    }

    const sheets = await getSheetsInstance();
    await ensureSheetExists(sheets, USERS_SHEET, ["Username", "Password", "Added_Date"]);

    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${USERS_SHEET}!A2:B`,
    });
    let rows = (res.data.values || []).filter((r) => (r[0] || "").toString().trim());

    // Freshly created (or emptied) Users sheet: seed a default account so
    // the team isn't locked out.
    if (rows.length === 0) {
      const today = new Date().toLocaleDateString("th-TH");
      await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: `${USERS_SHEET}!A2`,
        valueInputOption: "USER_ENTERED",
        requestBody: { values: [["admin", "admin123", today]] },
      });
      rows = [["admin", "admin123"]];
    }

    const match = rows.find(
      (r) =>
        (r[0] || "").toString().trim().toLowerCase() === username.toLowerCase() &&
        (r[1] || "").toString() === password,
    );
    if (!match) {
      return NextResponse.json(
        { success: false, error: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" },
        { status: 401 },
      );
    }

    const canonicalName = (match[0] || "").toString().trim();
    const token = await createSessionToken(canonicalName);
    const response = NextResponse.json({ success: true, username: canonicalName });
    response.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_MAX_AGE_SECONDS,
    });
    // Display-only (read by the Header to show who is logged in).
    response.cookies.set(USER_DISPLAY_COOKIE, encodeURIComponent(canonicalName), {
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_MAX_AGE_SECONDS,
    });
    return response;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
