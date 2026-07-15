"use client";

import { formatPriceInput } from "@/lib/format";

interface PriceInputProps {
  value: string;
  onChange: (formatted: string) => void;
  className?: string;
  placeholder?: string;
}

/** A text input that live-formats numeric price entry with thousands separators (e.g. "15,000"). */
export function PriceInput({ value, onChange, className, placeholder }: PriceInputProps) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
        ฿
      </span>
      <input
        type="text"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(formatPriceInput(e.target.value))}
        placeholder={placeholder}
        className={className || "w-full pl-6 p-2.5 border rounded-lg text-sm outline-none focus:ring-1 focus:ring-indigo-500"}
      />
    </div>
  );
}
