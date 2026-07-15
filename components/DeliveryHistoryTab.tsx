"use client";

import { useMemo, useState } from "react";
import { DeliveryLogItem, JobData } from "@/app/types";
import { PaginationControls } from "@/components/PaginationControls";
import { usePagination } from "@/hooks/usePagination";
import { exportRowsToExcel, exportTodayLabel } from "@/lib/export-excel";

const ITEMS_PER_PAGE = 10;

interface DeliveryHistoryTabProps {
  deliveryLogs: DeliveryLogItem[];
  jobs: JobData[];
  searchTerm: string;
  onSearchTermChange: (v: string) => void;
  onEdit: (log: DeliveryLogItem) => void;
  onDelete: (delivIds: string[]) => void;
}

export function DeliveryHistoryTab({
  deliveryLogs,
  jobs,
  searchTerm,
  onSearchTermChange,
  onEdit,
  onDelete,
}: DeliveryHistoryTabProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const jobsById = useMemo(() => {
    const map = new Map<string, JobData>();
    jobs.forEach((job) => map.set(job.Job_ID, job));
    return map;
  }, [jobs]);

  // Delivery records are appended to the end of the sheet, so reversing
  // after filtering puts the most recently added delivery on top.
  const filtered = deliveryLogs
    .filter(
      (log) =>
        log.Delivery_ID.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.Job_ID.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.Delivery_Note_No.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (log.Invoice_No || "").toLowerCase().includes(searchTerm.toLowerCase()),
    )
    .reverse();

  const { currentItems: pageLogs, currentPage, setCurrentPage, totalPages } = usePagination(
    filtered,
    ITEMS_PER_PAGE,
  );

  const allOnPageSelected = pageLogs.length > 0 && pageLogs.every((log) => selectedIds.has(log.Delivery_ID));

  const toggleRow = (delivId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(delivId)) next.delete(delivId);
      else next.add(delivId);
      return next;
    });
  };

  const togglePage = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allOnPageSelected) {
        pageLogs.forEach((log) => next.delete(log.Delivery_ID));
      } else {
        pageLogs.forEach((log) => next.add(log.Delivery_ID));
      }
      return next;
    });
  };

  const handleBulkDelete = () => {
    onDelete(Array.from(selectedIds));
    setSelectedIds(new Set());
  };

  const handleExport = () => {
    const headers = [
      "รหัสจัดส่ง",
      "Job ID",
      "ลูกค้า",
      "รายละเอียดงานผลิต",
      "วันที่จัดส่ง",
      "เลขใบส่งของ",
      "จำนวน (Pcs.)",
      "เลขใบกำกับภาษี",
      "หมายเหตุ",
    ];
    const rows = filtered.map((log) => {
      const job = jobsById.get(log.Job_ID);
      return [
        log.Delivery_ID,
        log.Job_ID,
        job?.Customer || "-",
        job?.Job_Description || "-",
        log.Delivery_Date,
        log.Delivery_Note_No,
        parseInt(log.Delivery_Qty) || 0,
        log.Invoice_No || "-",
        log.Remark || "-",
      ];
    });
    exportRowsToExcel(`PTW-JIGFIXTURE-ประวัติการส่งมอบงาน-${exportTodayLabel()}.xlsx`, "Delivery Log", headers, rows);
  };

  return (
    <div className="space-y-4">
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow duration-200 space-y-3">
        <h2 className="text-sm font-bold text-slate-800 whitespace-nowrap">
          📋 ประวัติการส่งมอบงานทั้งหมด (Delivery Log)
        </h2>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => onSearchTermChange(e.target.value)}
            placeholder="🔍 ค้นหารหัสจัดส่ง, Job ID, เลขใบส่งของ หรือเลขใบกำกับภาษี..."
            className="w-full flex-1 p-2 border border-slate-300 rounded-lg outline-none text-sm bg-slate-50"
          />
          <button
            type="button"
            onClick={handleExport}
            className="shrink-0 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-2 rounded-lg text-xs transition cursor-pointer flex items-center justify-center gap-1.5"
          >
            📊 Export
          </button>
        </div>
      </div>

      {selectedIds.size > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <span className="text-xs font-bold text-red-700">เลือกไว้ {selectedIds.size} รายการ</span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              className="text-xs bg-white border border-slate-300 text-slate-600 hover:bg-slate-50 font-bold px-3 py-1.5 rounded-lg transition cursor-pointer"
            >
              ล้างการเลือก
            </button>
            <button
              type="button"
              onClick={handleBulkDelete}
              className="text-xs bg-red-600 hover:bg-red-700 text-white font-bold px-3 py-1.5 rounded-lg transition cursor-pointer"
            >
              🗑️ ลบที่เลือก ({selectedIds.size})
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow duration-200 overflow-auto pb-3 max-h-[70vh]">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="sticky top-0 z-10 bg-slate-100 text-slate-600 border-b font-bold uppercase">
              <th className="p-3 border-r w-10 text-center">
                <input
                  type="checkbox"
                  checked={allOnPageSelected}
                  onChange={togglePage}
                  className="cursor-pointer w-3.5 h-3.5 accent-indigo-600"
                  aria-label="เลือกทั้งหมดในหน้านี้"
                />
              </th>
              <th className="p-3 border-r">รหัสจัดส่ง</th>
              <th className="p-3 border-r">Job ID</th>
              <th className="p-3 border-r">ลูกค้า & รายละเอียดงานผลิต</th>
              <th className="p-3 border-r">วันที่จัดส่ง</th>
              <th className="p-3 border-r">เลขใบส่งของ (Note)</th>
              <th className="p-3 text-center border-r">จำนวน (Pcs.)</th>
              <th className="p-3 border-r">เลขใบกำกับภาษี</th>
              <th className="p-3 border-r">หมายเหตุ</th>
              <th className="p-3 text-center">จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {pageLogs.length === 0 ? (
              <tr>
                <td colSpan={10} className="p-8 text-center text-slate-400 font-medium">
                  ❌ ไม่พบประวัติการจัดส่งตามเงื่อนไขที่ค้นหา
                </td>
              </tr>
            ) : (
              pageLogs.map((log) => {
                const job = jobsById.get(log.Job_ID);
                const isSelected = selectedIds.has(log.Delivery_ID);
                return (
                  <tr
                    key={log.Delivery_ID}
                    className={`transition border-b border-slate-200 ${isSelected ? "bg-indigo-50/60" : "hover:bg-slate-50"}`}
                  >
                    <td className="p-3 text-center border-r">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleRow(log.Delivery_ID)}
                        className="cursor-pointer w-3.5 h-3.5 accent-indigo-600"
                        aria-label={`เลือกรายการ ${log.Delivery_ID}`}
                      />
                    </td>
                    <td className="p-3 font-mono font-bold text-emerald-600 border-r">{log.Delivery_ID}</td>
                    <td className="p-3 font-mono font-bold text-indigo-600 border-r">{log.Job_ID}</td>
                    <td className="p-3 border-r">
                      <div className="text-[10px] text-indigo-800 font-bold uppercase">{job?.Customer || "-"}</div>
                      <div className="font-semibold text-slate-900 text-sm">{job?.Job_Description || "-"}</div>
                    </td>
                    <td className="p-3 font-medium text-slate-700 border-r">{log.Delivery_Date}</td>
                    <td className="p-3 text-slate-700 border-r">{log.Delivery_Note_No}</td>
                    <td className="p-3 text-center font-bold text-slate-800 border-r">{log.Delivery_Qty}</td>
                    <td className="p-3 text-slate-500 border-r">{log.Invoice_No || "-"}</td>
                    <td className="p-3 text-slate-500 border-r">{log.Remark || "-"}</td>
                    <td className="p-3 text-center space-x-1 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => onEdit(log)}
                        className="bg-violet-500 hover:bg-violet-600 text-white font-bold p-1 px-2 rounded text-[10px] transition cursor-pointer"
                      >
                        แก้ไข 📝
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete([log.Delivery_ID])}
                        className="bg-red-500 hover:bg-red-600 text-white font-bold p-1 px-2 rounded text-[10px] transition cursor-pointer"
                      >
                        ลบ 🗑️
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
        {totalPages > 1 && (
          <div className="px-4">
            <PaginationControls currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
          </div>
        )}
      </div>
    </div>
  );
}
