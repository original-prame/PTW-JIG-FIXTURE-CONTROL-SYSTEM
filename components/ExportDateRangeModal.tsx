"use client";

import { ThaiDateField } from "@/components/ThaiDateField";

interface ExportDateRangeModalProps {
  isOpen: boolean;
  startDate: string;
  endDate: string;
  onStartChange: (v: string) => void;
  onEndChange: (v: string) => void;
  onClose: () => void;
  onConfirm: () => void;
}

/**
 * Prompts for a PO-date range before running the production-table Excel
 * export, since that export is filtered to a specific PO date window
 * rather than exporting everything currently on screen.
 */
export function ExportDateRangeModal({
  isOpen,
  startDate,
  endDate,
  onStartChange,
  onEndChange,
  onClose,
  onConfirm,
}: ExportDateRangeModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-3 sm:p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl border w-full max-w-sm overflow-visible">
        <div className="bg-gradient-to-r from-indigo-950 via-indigo-900 to-violet-900 text-white p-4 rounded-t-2xl">
          <h3 className="font-bold text-base text-indigo-400">📊 Export ข้อมูลเป็น Excel</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            เลือกช่วงวันที่ใบสั่งซื้อ (PO Date) ที่ต้องการ export
          </p>
        </div>
        <div className="p-5 space-y-4">
          <ThaiDateField label="📅 ตั้งแต่วันที่ (PO Date)" value={startDate} onChange={onStartChange} />
          <ThaiDateField label="📅 ถึงวันที่ (PO Date)" value={endDate} onChange={onEndChange} />
        </div>
        <div className="bg-slate-50 p-4 border-t flex gap-2 justify-end rounded-b-2xl">
          <button
            type="button"
            onClick={onClose}
            className="bg-slate-300 hover:bg-slate-400 text-slate-700 font-bold px-4 py-2 rounded-lg text-xs transition cursor-pointer"
          >
            ยกเลิก
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white font-bold px-5 py-2 rounded-lg text-xs transition shadow cursor-pointer"
          >
            📊 Export
          </button>
        </div>
      </div>
    </div>
  );
}
