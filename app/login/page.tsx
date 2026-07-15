"use client";

import { useState } from "react";
import axios from "axios";

// Login screen backed by the "Users" sheet in the same Google Sheet as the
// production data (see app/auth/login/route.ts).
export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setError(null);
    setIsSubmitting(true);
    try {
      await axios.post("/auth/login", { username, password });
      // Full navigation (not router.push) so the middleware re-evaluates
      // the fresh session cookie.
      window.location.href = "/";
    } catch (err: unknown) {
      let message = "เข้าสู่ระบบไม่สำเร็จ";
      if (axios.isAxiosError(err) && err.response?.data?.error) {
        message = err.response.data.error as string;
      }
      setError(message);
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-950 via-slate-900 to-violet-950 p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl p-8">
        <h1 className="text-xl font-bold text-indigo-900 text-center">
          PTW JIG-FIXTURE CONTROL SYSTEM
        </h1>
        <p className="text-xs text-slate-500 text-center mt-1 mb-6">
          เข้าสู่ระบบเพื่อใช้งานระบบคุมงานผลิต
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
              ชื่อผู้ใช้ (Username)
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoFocus
              autoComplete="username"
              className="text-black w-full p-2.5 border border-slate-300 rounded-lg bg-slate-50 text-sm outline-none focus:border-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
              รหัสผ่าน (Password)
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              className="text-black w-full p-2.5 border border-slate-300 rounded-lg bg-slate-50 text-sm outline-none focus:border-indigo-500"
            />
          </div>

          {error && (
            <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-2.5">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 disabled:opacity-60 text-white font-bold py-2.5 rounded-lg text-sm transition shadow-md cursor-pointer"
          >
            {isSubmitting ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
          </button>
        </form>

      </div>
    </main>
  );
}
