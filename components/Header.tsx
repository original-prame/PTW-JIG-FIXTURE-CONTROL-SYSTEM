"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import { USER_DISPLAY_COOKIE } from "@/lib/auth";

interface HeaderProps {
  onRefresh: () => void;
}

function readDisplayUser(): string | null {
  const match = document.cookie
    .split("; ")
    .find((c) => c.startsWith(`${USER_DISPLAY_COOKIE}=`));
  if (!match) return null;
  try {
    return decodeURIComponent(match.split("=")[1] || "") || null;
  } catch {
    return null;
  }
}

export function Header({ onRefresh }: HeaderProps) {
  const [username, setUsername] = useState<string | null>(null);

  useEffect(() => {
    // Cookie is only readable in the browser, so resolve it after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUsername(readDisplayUser());
  }, []);

  const handleLogout = async () => {
    try {
      await axios.post("/auth/logout");
    } catch {
      // Even if the request fails, dropping to /login forces re-auth.
    }
    window.location.href = "/login";
  };

  return (
    <header className="bg-gradient-to-r from-indigo-950 via-indigo-900 to-violet-900 text-white p-4 shadow-lg flex flex-col sm:flex-row gap-3 sm:justify-between sm:items-center">
      <div className="min-w-0">
        <h1 className="text-base sm:text-xl font-bold tracking-tight text-indigo-400 truncate">
          PTW JIG-FIXTURE CONTROL SYSTEM
        </h1>
        <p className="text-[11px] sm:text-xs text-slate-400">
          ระบบคุมงานผลิต jig & fixture ของบริษัท PTW
        </p>
      </div>
      <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
        {username && (
          <span className="text-xs text-slate-300 hidden sm:inline">👤 {username}</span>
        )}
        <button
          onClick={onRefresh}
          className="bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 px-4 py-2 rounded-lg font-bold text-xs sm:text-sm transition shadow-md shadow-indigo-950/40 cursor-pointer"
        >
          🔄 รีเฟรชข้อมูล
        </button>
        <button
          onClick={handleLogout}
          title="ออกจากระบบ"
          className="bg-white/10 hover:bg-white/20 px-3 py-2 rounded-lg font-bold text-xs sm:text-sm transition cursor-pointer"
        >
          🚪 ออกจากระบบ
        </button>
      </div>
    </header>
  );
}
