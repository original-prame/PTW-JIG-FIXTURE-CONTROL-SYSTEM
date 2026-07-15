"use client";

interface LoaderProps {
  label?: string;
}

/**
 * Full-width branded loading state: two counter-spinning gradient rings
 * plus a "..." pulsing-dots label. Replaces the old plain animate-pulse
 * text line shown while the dashboard's data is being fetched.
 */
export function Loader({ label = "กำลังประมวลผลข้อมูลสดจาก Google Sheets" }: LoaderProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-5 py-20">
      <div className="relative w-16 h-16">
        <div className="absolute inset-0 rounded-full border-4 border-indigo-100" />
        <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-indigo-600 border-r-indigo-600 animate-spin" />
        <div className="absolute inset-2 rounded-full border-4 border-transparent border-b-violet-500 border-l-violet-500 animate-spin-reverse" />
      </div>
      <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-500">
        <span>{label}</span>
        <span className="flex gap-0.5">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse-dot [animation-delay:-0.32s]" />
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse-dot [animation-delay:-0.16s]" />
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse-dot" />
        </span>
      </div>
    </div>
  );
}
