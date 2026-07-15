"use client";

import { useRef, useState } from "react";
import { THAI_MONTHS, THAI_DAYS_SHORT, getCurrentYearBE, parseThaiDateToObj } from "@/lib/thai-date";
import { useOutsideClick } from "@/hooks/useOutsideClick";

interface SingleSideProps {
  label: string;
  value: string; // Thai "DD/MM/YYYY"
  onChange: (thaiDateStr: string) => void;
  align: "left" | "right";
}

function DateSide({ label, value, onChange, align }: SingleSideProps) {
  const [isOpen, setIsOpen] = useState(false);
  const initial = value ? parseThaiDateToObj(value) : null;
  const [month, setMonth] = useState<number>(initial ? initial.getMonth() : new Date().getMonth());
  const [year, setYear] = useState<number>(initial ? initial.getFullYear() + 543 : getCurrentYearBE());
  const ref = useRef<HTMLDivElement>(null);

  useOutsideClick(ref, () => setIsOpen(false));

  const changeMonth = (direction: "prev" | "next") => {
    if (direction === "prev") {
      if (month === 0) {
        setMonth(11);
        setYear(year - 1);
      } else {
        setMonth(month - 1);
      }
    } else {
      if (month === 11) {
        setMonth(0);
        setYear(year + 1);
      } else {
        setMonth(month + 1);
      }
    }
  };

  const firstDayIndexRaw = new Date(year - 543, month, 1).getDay();
  const firstDayIndex = firstDayIndexRaw === 0 ? 6 : firstDayIndexRaw - 1;
  const totalDays = new Date(year - 543, month + 1, 0).getDate();

  return (
    <div className="relative" ref={ref}>
      <label className="block text-[10px] font-bold text-slate-400 mb-0.5">{label}</label>
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between border rounded-lg px-2.5 py-1.5 text-xs text-slate-700 bg-slate-50 hover:bg-slate-100 cursor-pointer min-w-[130px]"
      >
        <span>{value || "เลือกวันที่ พ.ศ."}</span>
        <span className="text-slate-400 text-[10px]">▼</span>
      </div>

      {isOpen && (
        <div
          className={`absolute ${align === "left" ? "left-0" : "right-0"} mt-1 bg-white border border-slate-200 rounded-2xl shadow-xl p-3 z-50 w-[260px] max-w-[85vw]`}
        >
          <div className="flex justify-between items-center mb-2">
            <button
              type="button"
              onClick={() => changeMonth("prev")}
              className="p-1 hover:bg-slate-100 rounded text-xs font-bold cursor-pointer"
            >
              ◀
            </button>
            <span className="text-xs font-bold text-slate-700">
              {THAI_MONTHS[month]} {year}
            </span>
            <button
              type="button"
              onClick={() => changeMonth("next")}
              className="p-1 hover:bg-slate-100 rounded text-xs font-bold cursor-pointer"
            >
              ▶
            </button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-slate-400 mb-1">
            {THAI_DAYS_SHORT.map((d) => (
              <div key={d}>{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: firstDayIndex }).map((_, i) => (
              <div key={`empty-${i}`} />
            ))}
            {Array.from({ length: totalDays }).map((_, i) => {
              const dayNum = i + 1;
              const currentStr = `${String(dayNum).padStart(2, "0")}/${String(month + 1).padStart(2, "0")}/${year}`;
              const isSelected = value === currentStr;
              return (
                <button
                  key={`day-${dayNum}`}
                  type="button"
                  onClick={() => {
                    onChange(currentStr);
                    setIsOpen(false);
                  }}
                  className={`p-1 text-xs rounded-md font-medium transition cursor-pointer ${
                    isSelected ? "bg-indigo-600 text-white font-bold" : "hover:bg-slate-100 text-slate-600"
                  }`}
                >
                  {dayNum}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

interface ThaiDateRangeFilterProps {
  startValue: string;
  endValue: string;
  onStartChange: (v: string) => void;
  onEndChange: (v: string) => void;
  onClear: () => void;
}

/** The PO-date range filter (start + end calendars + clear button) used above the financial overview. */
export function ThaiDateRangeFilter({
  startValue,
  endValue,
  onStartChange,
  onEndChange,
  onClear,
}: ThaiDateRangeFilterProps) {
  return (
    <div className="flex flex-wrap items-center gap-3 bg-white p-2 rounded-2xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow duration-200">
      <DateSide
        label="วันที่เปิด PO (เริ่มต้น)"
        value={startValue}
        onChange={onStartChange}
        align="left"
      />
      <DateSide
        label="วันที่เปิด PO (สิ้นสุด)"
        value={endValue}
        onChange={onEndChange}
        align="right"
      />
      {(startValue || endValue) && (
        <button
          onClick={onClear}
          className="mt-4 text-xs bg-rose-50 text-rose-600 font-bold px-2.5 py-1.5 rounded-lg hover:bg-rose-100 transition-colors cursor-pointer"
        >
          ล้างค่า
        </button>
      )}
    </div>
  );
}
