"use client";

import { useMemo, useState } from "react";
import { JobData } from "@/app/types";
import { usePagination } from "@/hooks/usePagination";
import { PaginationControls } from "@/components/PaginationControls";

const ITEMS_PER_PAGE = 5;

interface IncompleteDeliveriesTableProps {
  incompleteDeliveries: JobData[];
}

type OutstandingSortOrder = "asc" | "desc";

function outstandingQty(job: JobData): number {
  const target = parseInt(job.Qty) || 0;
  const deliv = job.delivered_qty_total || 0;
  return target - deliv;
}

export function IncompleteDeliveriesTable({ incompleteDeliveries }: IncompleteDeliveriesTableProps) {
  const [sortOrder, setSortOrder] = useState<OutstandingSortOrder>("asc");

  const sortedDeliveries = useMemo(() => {
    const sorted = [...incompleteDeliveries];
    sorted.sort((a, b) =>
      sortOrder === "asc" ? outstandingQty(a) - outstandingQty(b) : outstandingQty(b) - outstandingQty(a),
    );
    return sorted;
  }, [incompleteDeliveries, sortOrder]);

  const { currentItems: currentDeliveries, currentPage, setCurrentPage, totalItems, totalPages } = usePagination(
    sortedDeliveries,
    ITEMS_PER_PAGE,
  );

  return (
    <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow duration-200">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 border-b pb-2 mb-3">
        <h3 className="text-sm font-bold text-slate-700 uppercase">
          📦 รายการงานผลิตที่ยังจัดส่งไม่ครบยอดออเดอร์
        </h3>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"))}
            className="flex items-center gap-1 text-xs font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded-full transition cursor-pointer"
            title="เรียงตามยอดคงค้างจัดส่ง"
          >
            ⚖️ คงค้าง {sortOrder === "asc" ? "น้อย→มาก" : "มาก→น้อย"} {sortOrder === "asc" ? "▲" : "▼"}
          </button>
          <span className="bg-amber-100 text-amber-700 text-xs font-bold px-2.5 py-0.5 rounded-full">
            ทั้งหมด {totalItems} รายการ
          </span>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-50 border-b text-slate-600 font-bold">
              <th className="p-2.5">Job ID</th>
              <th className="p-2.5">ลูกค้า</th>
              <th className="p-2.5">รายละเอียดชิ้นงาน</th>
              <th className="p-2.5 text-slate-600">เลขที่ PO</th>
              <th className="p-2.5 text-center">จำนวนสั่งผลิต</th>
              <th className="p-2.5 text-center">จัดส่งไปแล้ว</th>
              <th className="p-2.5 text-center">ยอดคงค้างจัดส่ง</th>
            </tr>
          </thead>
          <tbody>
            {currentDeliveries.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-6 text-center text-slate-400">
                  ✓ จัดส่งครบถ้วนหมดทุกรายการแล้วในระบบ
                </td>
              </tr>
            ) : (
              currentDeliveries.map((job) => {
                const target = parseInt(job.Qty) || 0;
                const deliv = job.delivered_qty_total || 0;
                return (
                  <tr key={job.Job_ID} className="border-b hover:bg-slate-50/80">
                    <td className="p-2.5 font-mono font-bold text-indigo-600">{job.Job_ID}</td>
                    <td className="p-2.5 font-semibold text-slate-800">{job.Customer}</td>
                    <td className="p-2.5 text-slate-600">{job.Job_Description}</td>
                    <td className="p-2.5 font-mono text-slate-600 font-semibold">{job.PO || "-"}</td>
                    <td className="p-2.5 text-center font-bold text-slate-700 text-sm">{target}</td>
                    <td className="p-2.5 text-center font-bold text-green-600 text-sm">{deliv}</td>
                    <td className="p-2.5 text-center font-bold text-amber-600 bg-amber-50/30 text-sm">
                      {target - deliv}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <PaginationControls currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
    </div>
  );
}
