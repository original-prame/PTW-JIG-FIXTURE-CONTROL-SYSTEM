import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";

// Everything except the login page, the auth endpoints, and static assets
// requires a valid session cookie. Page requests are redirected to /login;
// API requests get a JSON 401 so the frontend can show a clear error.
export async function middleware(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const username = await verifySessionToken(token);
  const { pathname } = request.nextUrl;

  if (pathname === "/login") {
    // Already logged in - go straight to the dashboard.
    if (username) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return NextResponse.next();
  }

  if (username) return NextResponse.next();

  if (pathname.startsWith("/sheets")) {
    return NextResponse.json(
      { success: false, error: "กรุณาเข้าสู่ระบบก่อนใช้งาน" },
      { status: 401 },
    );
  }
  const loginUrl = new URL("/login", request.url);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  // Skip Next.js internals, the auth endpoints themselves, and static files
  // (anything with a file extension, e.g. /pdf.worker.min.mjs, *.svg).
  matcher: ["/((?!_next|auth/|favicon\\.ico|.*\\..*).*)", "/sheets"],
};
