"use client";

import { ThaiDateRangeFilter } from "@/components/ThaiDateRangeFilter";
import { PaginationControls } from "@/components/PaginationControls";
import { usePagination } from "@/hooks/usePagination";
import { FinancialSummary } from "@/lib/dashboard-calculations";

const MONTHLY_ITEMS_PER_PAGE = 12;

interface FinancialOverviewProps {
  financialStartDate: string;
  financialEndDate: string;
  onStartChange: (v: string) => void;
  onEndChange: (v: string) => void;
  onClear: () => void;
  summary: FinancialSummary;
}

export function FinancialOverview({
  financialStartDate,
  financialEndDate,
  onStartChange,
  onEndChange,
  onClear,
  summary,
}: FinancialOverviewProps) {
  const { totalFinancialValue, totalDeliveredValue, totalPendingValue, monthlyRevenueList, maxMonthlyValue } =
    summary;

  const {
    currentItems: pageMonthlyRevenue,
    currentPage: monthlyPage,
    setCurrentPage: setMonthlyPage,
    totalPages: monthlyTotalPages,
  } = usePagination(monthlyRevenueList, MONTHLY_ITEMS_PER_PAGE);

  return (
    <div className="space-y-6 mt-6 bg-slate-50 p-4 rounded-2xl border border-slate-200">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-4">
        <div>
          <h3 className="text-sm font-bold text-slate-700 uppercase">
            💰 สรุปรายงาน & วิเคราะห์กราฟทางการเงิน
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            วิเคราะห์ยอดเงินและ backlogs อ้างอิงตามวันที่เปิด PO
          </p>
        </div>

        <ThaiDateRangeFilter
          startValue={financialStartDate}
          endValue={financialEndDate}
          onStartChange={onStartChange}
          onEndChange={onEndChange}
          onClear={onClear}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-indigo-500 to-violet-600 p-4 rounded-2xl shadow-md text-white flex flex-col justify-between">
          <span className="text-xs font-bold uppercase text-indigo-100">
            💵 มูลค่ารวมใบสั่งซื้อ
          </span>
          <span className="text-2xl font-black mt-2">
            {totalFinancialValue.toLocaleString("th-TH", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}{" "}
            <span className="text-xs font-normal opacity-80">บาท</span>
          </span>
        </div>
        <div className="bg-gradient-to-br from-emerald-500 to-teal-600 p-4 rounded-2xl shadow-sm text-white flex flex-col justify-between">
          <span className="text-xs font-bold uppercase text-emerald-100">
            🚛 มูลค่าที่ส่งของแล้ว
          </span>
          <span className="text-2xl font-black mt-2">
            {totalDeliveredValue.toLocaleString("th-TH", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}{" "}
            <span className="text-xs font-normal opacity-80">บาท</span>
          </span>
        </div>
        <div className="bg-gradient-to-br from-rose-500 to-pink-600 p-4 rounded-2xl shadow-sm text-white flex flex-col justify-between">
          <span className="text-xs font-bold uppercase text-rose-100">
            ⏳ มูลค่างานค้างจัดส่ง
          </span>
          <span className="text-2xl font-black mt-2">
            {totalPendingValue.toLocaleString("th-TH", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}{" "}
            <span className="text-xs font-normal opacity-80">บาท</span>
          </span>
        </div>
      </div>

      <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow duration-200">
        <h4 className="text-xs font-bold text-slate-500 uppercase mb-4">
          📊 ยอดเงินแยกตามเดือนที่เปิด PO ในขอบเขตเวลาที่เลือก
        </h4>
        {monthlyRevenueList.length === 0 ? (
          <div className="text-center py-8 text-xs text-slate-400">
            ไม่พบข้อมูลราคา หรือไม่มีวันที่เปิด PO ในช่วงเวลาที่เลือก
          </div>
        ) : (
          <div className="space-y-3">
            {pageMonthlyRevenue.map((item) => {
              const percentage = (item.value / maxMonthlyValue) * 100;
              return (
                <div key={item.label} className="grid grid-cols-4 items-center gap-2 text-xs">
                  <span className="font-bold text-slate-600 text-right pr-3 truncate">{item.label}</span>
                  <div className="col-span-3 flex items-center gap-3">
                    <div className="w-full bg-slate-100 h-6 rounded-md overflow-hidden shadow-inner relative flex items-center">
                      <div
                        style={{ width: `${percentage}%` }}
                        className="bg-indigo-500 h-full transition-all duration-500"
                      />
                    </div>
                    <span className="font-bold text-slate-700 whitespace-nowrap min-w-[100px]">
                      {item.value.toLocaleString("th-TH")} บ.
                    </span>
                  </div>
                </div>
              );
            })}
            <PaginationControls
              currentPage={monthlyPage}
              totalPages={monthlyTotalPages}
              onPageChange={setMonthlyPage}
            />
          </div>
        )}
      </div>
    </div>
  );
}
