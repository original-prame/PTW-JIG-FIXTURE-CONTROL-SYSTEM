"use client";

import { useMemo, useState } from "react";
import { JobData } from "@/app/types";
import { parseThaiDateToObj } from "@/lib/thai-date";
import { usePagination } from "@/hooks/usePagination";
import { PaginationControls } from "@/components/PaginationControls";

const ITEMS_PER_PAGE = 3;

interface UrgentJobsPanelProps {
  urgentJobs: JobData[];
  urgentDaysConfig: number;
}

type DueDateSortOrder = "asc" | "desc";

export function UrgentJobsPanel({ urgentJobs, urgentDaysConfig }: UrgentJobsPanelProps) {
  const [dueDateSortOrder, setDueDateSortOrder] = useState<DueDateSortOrder>("asc");

  const sortedUrgentJobs = useMemo(() => {
    const withParsedDate = urgentJobs.map((job) => ({
      job,
      dueDateMs: parseThaiDateToObj(job.Due_Date)?.getTime() ?? null,
    }));
    withParsedDate.sort((a, b) => {
      // Jobs with an unparseable/missing due date are pushed to the end
      // regardless of sort direction.
      if (a.dueDateMs === null && b.dueDateMs === null) return 0;
      if (a.dueDateMs === null) return 1;
      if (b.dueDateMs === null) return -1;
      return dueDateSortOrder === "asc" ? a.dueDateMs - b.dueDateMs : b.dueDateMs - a.dueDateMs;
    });
    return withParsedDate.map((item) => item.job);
  }, [urgentJobs, dueDateSortOrder]);

  const { currentItems: currentUrgentJobs, currentPage, setCurrentPage, totalItems, totalPages } = usePagination(
    sortedUrgentJobs,
    ITEMS_PER_PAGE,
  );

  return (
    <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow duration-200">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mb-4">
        <h3 className="text-sm font-bold text-slate-700 uppercase flex items-center gap-2">
          ⏰ รายการแจ้งเตือนงานใกล้กำหนดส่ง (ภายใน {urgentDaysConfig} วัน)
        </h3>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setDueDateSortOrder((prev) => (prev === "asc" ? "desc" : "asc"))}
            className="flex items-center gap-1 text-xs font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded-full transition cursor-pointer"
            title="เรียงตามวันที่ดีล"
          >
            📅 ดีล {dueDateSortOrder === "asc" ? "น้อย→มาก" : "มาก→น้อย"} {dueDateSortOrder === "asc" ? "▲" : "▼"}
          </button>
          <span className="bg-rose-100 text-rose-700 text-xs font-bold px-2.5 py-0.5 rounded-full">
            ทั้งหมด {totalItems} รายการ
          </span>
        </div>
      </div>

      {currentUrgentJobs.length === 0 ? (
        <div className="text-center py-6 text-xs text-slate-400">ไม่มีงานที่ใกล้กำหนดส่งในขณะนี้</div>
      ) : (
        <div className="space-y-2">
          {currentUrgentJobs.map((job) => (
            <div
              key={job.Job_ID}
              className="p-3 border rounded-2xl flex justify-between items-center gap-3 bg-slate-50 hover:bg-slate-100 transition"
            >
              <div className="text-xs min-w-0 flex-1">
                <div className="truncate">
                  <span className="font-bold text-indigo-600 mr-2">[{job.Job_ID}]</span>
                  <span className="text-slate-700 font-medium">{job.Job_Description}</span>
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5 truncate">
                  ลูกค้า: {job.Customer} | แผนกปัจจุบัน: (สถานะงานผลิต)
                </div>
              </div>
              <div className="text-right shrink-0">
                <span className="text-xs font-bold text-rose-600 block">ดีล: {job.Due_Date}</span>
                <span className="text-[10px] text-slate-500">จำนวน: {job.Qty} ชิ้น</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <PaginationControls currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
    </div>
  );
}
