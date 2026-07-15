"use client";

import { useRef, useState } from "react";
import { THAI_MONTHS, THAI_DAYS_SHORT, convertToThaiDateFormat } from "@/lib/thai-date";
import { useOutsideClick } from "@/hooks/useOutsideClick";

interface ThaiDateFieldProps {
  label: string;
  /** Selected date as an ISO "YYYY-MM-DD" string, or "" if unset. */
  value: string;
  onChange: (isoDateStr: string) => void;
  className?: string;
}

/**
 * A labeled input that opens a Buddhist-Era (พ.ศ.) calendar popover for
 * picking a date. Value is stored/emitted as ISO "YYYY-MM-DD" and
 * displayed as Thai "DD/MM/YYYY".
 *
 * This single component replaces six near-identical calendar blocks that
 * were previously copy-pasted inline (new job due date, new job PO date,
 * delivery date, edit-job due date, edit-job PO date, edit-delivery date).
 */
export function ThaiDateField({ label, value, onChange, className }: ThaiDateFieldProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [viewDate, setViewDate] = useState<Date>(() => (value ? new Date(value) : new Date()));
  const containerRef = useRef<HTMLDivElement>(null);

  useOutsideClick(containerRef, () => setIsOpen(false));

  const openPicker = () => {
    setViewDate(value ? new Date(value) : new Date());
    setIsOpen(true);
  };

  const changeMonth = (direction: "prev" | "next") => {
    setViewDate((prev) => {
      const next = new Date(prev);
      next.setMonth(prev.getMonth() + (direction === "next" ? 1 : -1));
      return next;
    });
  };

  const renderDays = () => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    let firstDayIndex = new Date(year, month, 1).getDay();
    firstDayIndex = firstDayIndex === 0 ? 6 : firstDayIndex - 1;
    const totalDays = new Date(year, month + 1, 0).getDate();
    const cells = [];

    for (let i = 0; i < firstDayIndex; i++) {
      cells.push(<div key={`empty-${i}`} className="p-2"></div>);
    }

    for (let day = 1; day <= totalDays; day++) {
      const dateIsoStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const isSelected = value === dateIsoStr;
      cells.push(
        <button
          key={`day-${day}`}
          type="button"
          onClick={() => {
            onChange(dateIsoStr);
            setIsOpen(false);
          }}
          className={`p-2 text-sm font-medium rounded-full text-center cursor-pointer aspect-square flex items-center justify-center transition
            ${isSelected ? "bg-indigo-500 text-white font-bold shadow" : "text-slate-700 hover:bg-slate-100 hover:text-indigo-600"}`}
        >
          {day}
        </button>,
      );
    }
    return cells;
  };

  return (
    <div className={`relative ${className || ""}`} ref={containerRef}>
      <label className="block text-sm font-medium mb-1">{label}</label>
      <div
        onClick={openPicker}
        className="w-full p-2.5 border border-slate-300 rounded-lg bg-white text-sm cursor-pointer flex justify-between items-center font-semibold text-slate-700"
      >
        <span>{value ? convertToThaiDateFormat(value) : "วว/ดด/ปปปป"}</span>
        <span className="text-slate-400 text-xs">📅</span>
      </div>
      {isOpen && (
        <div className="absolute right-0 mt-1 z-50 w-full sm:w-72 bg-white border border-slate-200 rounded-2xl shadow-2xl p-4 text-slate-800">
          <div className="flex justify-between items-center mb-3 border-b pb-2">
            <button
              type="button"
              onClick={() => changeMonth("prev")}
              className="p-1.5 text-sm font-bold text-slate-400 hover:text-indigo-500 cursor-pointer"
            >
              ‹
            </button>
            <span className="font-bold text-sm text-slate-800">
              {THAI_MONTHS[viewDate.getMonth()]} &nbsp; {viewDate.getFullYear() + 543}
            </span>
            <button
              type="button"
              onClick={() => changeMonth("next")}
              className="p-1.5 text-sm font-bold text-slate-400 hover:text-indigo-500 cursor-pointer"
            >
              ›
            </button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-xs font-bold text-slate-400 mb-2">
            {THAI_DAYS_SHORT.map((d) => (
              <div key={d}>{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">{renderDays()}</div>
        </div>
      )}
    </div>
  );
}
