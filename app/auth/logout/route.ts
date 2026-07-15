import { NextResponse } from "next/server";
import { SESSION_COOKIE, USER_DISPLAY_COOKIE } from "@/lib/auth";

export async function POST() {
  const response = NextResponse.json({ success: true });
  response.cookies.set(SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  response.cookies.set(USER_DISPLAY_COOKIE, "", { path: "/", maxAge: 0 });
  return response;
}
