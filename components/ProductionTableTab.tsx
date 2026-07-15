"use client";

import { useState } from "react";
import { JobData, DeliveryFilterType, ProductionStatusColumn } from "@/app/types";
import { CustomerCombobox } from "@/components/CustomerCombobox";
import { StatusSelect } from "@/components/StatusSelect";
import { PaginationControls } from "@/components/PaginationControls";
import { ExportDateRangeModal } from "@/components/ExportDateRangeModal";
import { usePagination } from "@/hooks/usePagination";
import { formatCurrencyDisplay, parsePrice } from "@/lib/format";
import { exportRowsToExcel, exportFileDateLabel } from "@/lib/export-excel";
import { parseThaiDateToObj } from "@/lib/thai-date";
import { useToast } from "@/components/toast/ToastProvider";

const ITEMS_PER_PAGE = 10;

const STATUS_COLUMNS: ProductionStatusColumn[] = [
  "Status_Drawing",
  "Status_Mat",
  "Status_CNC",
  "Status_Milling",
  "Status_Assembly",
];

interface ProductionTableTabProps {
  filteredData: JobData[];
  searchTerm: string;
  onSearchTermChange: (v: string) => void;
  customerFilterInput: string;
  onCustomerFilterChange: (v: string) => void;
  customerOptions: string[];
  deliveryStatusFilter: DeliveryFilterType;
  onDeliveryStatusFilterChange: (v: DeliveryFilterType) => void;
  onStatusChange: (jobId: string, column: string, nextVal: string) => void;
  onEdit: (job: JobData) => void;
  onDelete: (jobIds: string[]) => void;
}

export function ProductionTableTab({
  filteredData,
  searchTerm,
  onSearchTermChange,
  customerFilterInput,
  onCustomerFilterChange,
  customerOptions,
  deliveryStatusFilter,
  onDeliveryStatusFilterChange,
  onStatusChange,
  onEdit,
  onDelete,
}: ProductionTableTabProps) {
  const { showToast } = useToast();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportStartDate, setExportStartDate] = useState("");
  const [exportEndDate, setExportEndDate] = useState("");

  const { currentItems: pageData, currentPage, setCurrentPage, totalPages } = usePagination(
    filteredData,
    ITEMS_PER_PAGE,
  );

  const allOnPageSelected = pageData.length > 0 && pageData.every((job) => selectedIds.has(job.Job_ID));

  const toggleRow = (jobId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(jobId)) next.delete(jobId);
      else next.add(jobId);
      return next;
    });
  };

  const togglePage = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allOnPageSelected) {
        pageData.forEach((job) => next.delete(job.Job_ID));
      } else {
        pageData.forEach((job) => next.add(job.Job_ID));
      }
      return next;
    });
  };

  const handleBulkDelete = () => {
    onDelete(Array.from(selectedIds));
    setSelectedIds(new Set());
  };

  const handleConfirmExport = () => {
    if (!exportStartDate || !exportEndDate)
      return showToast("กรุณาเลือกวันที่เริ่มต้นและวันที่สิ้นสุด", "warning");
    if (new Date(exportStartDate) > new Date(exportEndDate))
      return showToast("วันที่เริ่มต้นต้องไม่เกินวันที่สิ้นสุด", "warning");

    const rangeStart = new Date(exportStartDate);
    rangeStart.setHours(0, 0, 0, 0);
    const rangeEnd = new Date(exportEndDate);
    rangeEnd.setHours(23, 59, 59, 999);

    const rowsInRange = filteredData.filter((job) => {
      const poDate = parseThaiDateToObj(job.PO_Date || "");
      return poDate !== null && poDate >= rangeStart && poDate <= rangeEnd;
    });

    if (rowsInRange.length === 0)
      return showToast("ไม่พบข้อมูลที่มีวันที่ใบสั่งซื้ออยู่ในช่วงที่เลือก", "warning");

    const headers = [
      "ลูกค้า",
      "ชื่อรายการ",
      "จำนวน",
      "ราคาต่อหน่วย",
      "ราคารวม",
      "เลขที่ใบเสนอราคา",
      "เลขที่ใบสั่งซื้อ",
      "วันที่ใบสั่งซื้อ",
      "วันกำหนดส่งมอบ",
    ];
    const rows = rowsInRange.map((job) => {
      const qty = parseInt(job.Qty) || 0;
      const unitPrice = parsePrice(job.Price);
      const totalPrice = qty * unitPrice;
      return [
        job.Customer,
        job.Job_Description,
        qty,
        unitPrice,
        totalPrice,
        job.Quotation || "-",
        job.PO || "-",
        job.PO_Date || "-",
        job.Due_Date,
      ];
    });

    const filename = `PTW-JIGFIXTURE ${exportFileDateLabel(exportStartDate)}-${exportFileDateLabel(exportEndDate)}.xlsx`;
    exportRowsToExcel(filename, "Production Status", headers, rows);
    setIsExportModalOpen(false);
  };

  return (
    <div className="space-y-4">
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow duration-200 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
            🔍 ค้นหาข้อมูลชิ้นงาน
          </label>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => onSearchTermChange(e.target.value)}
            placeholder="พิมพ์เพื่อหา Job ID, รายละเอียดงาน, เลข PO..."
            className="w-full p-2.5 border border-slate-300 rounded-lg outline-none text-sm bg-slate-50"
          />
        </div>

        <CustomerCombobox
          label="🏢 กรองรายชื่อลูกค้า"
          value={customerFilterInput}
          onChange={onCustomerFilterChange}
          options={customerOptions}
          placeholder="คลิกเลือก หรือพิมพ์เพื่อค้นหา..."
          showResetAll
        />

        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
            🚚 ตัวกรองสถานะจัดส่ง
          </label>
          <div className="flex gap-2">
            <select
              value={deliveryStatusFilter}
              onChange={(e) => onDeliveryStatusFilterChange(e.target.value as DeliveryFilterType)}
              className="w-full p-2.5 border border-slate-300 rounded-lg bg-slate-50 outline-none text-sm font-semibold text-slate-700 cursor-pointer"
            >
              <option value="all">🚚 ทั้งหมด (ไม่กรองสถานะ)</option>
              <option value="completed">✓ ครบยอด</option>
              <option value="partial">⏳ ทยอยส่ง</option>
              <option value="pending">⚪ รอดำเนินการ</option>
            </select>
            <button
              type="button"
              onClick={() => setIsExportModalOpen(true)}
              title="Export ข้อมูลที่กรองไว้ไปยัง Excel"
              className="shrink-0 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-2 rounded-lg text-xs transition cursor-pointer flex items-center justify-center gap-1.5"
            >
              📊 Export
            </button>
          </div>
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
            <tr className="sticky top-0 z-10 bg-gradient-to-r from-indigo-950 via-indigo-900 to-violet-900 text-white border-b font-bold uppercase">
              <th className="p-3 border-r border-indigo-800/50 w-10 text-center">
                <input
                  type="checkbox"
                  checked={allOnPageSelected}
                  onChange={togglePage}
                  className="cursor-pointer w-3.5 h-3.5 accent-indigo-400"
                  aria-label="เลือกทั้งหมดในหน้านี้"
                />
              </th>
              <th className="p-3 border-r border-indigo-800/50">Job ID</th>
              <th className="p-3 border-r border-indigo-800/50">ลูกค้า & รายละเอียดงานผลิต</th>
              <th className="p-3 text-center border-r border-indigo-800/50">จำนวน</th>
              <th className="p-3 border-r border-indigo-800/50">กำหนดส่ง</th>
              <th className="p-2 text-center border-r border-indigo-800/50 w-16">แบบ</th>
              <th className="p-2 text-center border-r border-indigo-800/50 w-16">วัสดุ</th>
              <th className="p-2 text-center border-r border-indigo-800/50 w-16">CNC</th>
              <th className="p-2 text-center border-r border-indigo-800/50 w-16">Milling</th>
              <th className="p-2 text-center border-r border-indigo-800/50 w-16">Assembly</th>
              <th className="p-3 text-center border-r border-indigo-800/50 w-40">สถานะจัดส่ง</th>
              <th className="p-3 border-r border-indigo-800/50">หมายเหตุ</th>
              <th className="p-3 text-center">จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {pageData.length === 0 ? (
              <tr>
                <td colSpan={13} className="p-8 text-center text-slate-400 font-medium">
                  ❌ ไม่พบข้อมูลงานตามเงื่อนไขการค้นหา/ตัวกรองที่เลือก
                </td>
              </tr>
            ) : (
              pageData.map((job) => {
                const targetQty = parseInt(job.Qty) || 0;
                const deliveredQty = job.delivered_qty_total || 0;
                const isSelected = selectedIds.has(job.Job_ID);
                return (
                  <tr
                    key={job.Job_ID}
                    className={`transition border-b border-slate-200 ${isSelected ? "bg-indigo-50/60" : "hover:bg-slate-50"}`}
                  >
                    <td className="p-3 text-center border-r">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleRow(job.Job_ID)}
                        className="cursor-pointer w-3.5 h-3.5 accent-indigo-600"
                        aria-label={`เลือกรายการ ${job.Job_ID}`}
                      />
                    </td>
                    <td className="p-3 font-mono font-bold text-indigo-600 bg-slate-50/30 border-r">
                      {job.Job_ID}
                    </td>
                    <td className="p-3 border-r">
                      <div className="text-[10px] text-indigo-800 font-bold uppercase">{job.Customer}</div>
                      <div className="font-semibold text-slate-900 text-sm">{job.Job_Description}</div>
                      <div className="text-slate-400 mt-0.5">
                        PO: {job.PO || "-"} | Quote: {job.Quotation || "-"} | ราคา: {formatCurrencyDisplay(job.Price)}
                      </div>
                    </td>
                    <td className="p-3 font-bold text-center text-slate-700 border-r text-sm">{job.Qty}</td>
                    <td className="p-3 text-red-600 font-semibold border-r">{job.Due_Date}</td>
                    {STATUS_COLUMNS.map((col) => (
                      <td key={col} className="p-1 border-r text-center w-16">
                        <StatusSelect
                          value={job[col]}
                          onChange={(nextVal) => onStatusChange(job.Job_ID, col, nextVal)}
                        />
                      </td>
                    ))}
                    <td className="p-3 border-r text-center font-bold w-40">
                      {deliveredQty >= targetQty && targetQty > 0 ? (
                        <span className="text-green-600 bg-green-50 px-2 py-1 rounded-full text-[10px] whitespace-nowrap">
                          ✓ ครบ ({deliveredQty}/{targetQty})
                        </span>
                      ) : deliveredQty > 0 ? (
                        <span className="text-amber-600 bg-amber-50 px-2 py-1 rounded-full text-[10px] whitespace-nowrap">
                          ⏳ ทยอย ({deliveredQty}/{targetQty})
                        </span>
                      ) : (
                        <span className="text-slate-400 bg-slate-50 px-2 py-1 rounded-full text-[10px] whitespace-nowrap">
                          ⚪ รอดำเนินการ
                        </span>
                      )}
                    </td>
                    <td className="p-3 border-r text-slate-500 max-w-[160px] truncate" title={job.Remark || ""}>
                      {job.Remark || "-"}
                    </td>
                    <td className="p-3 text-center space-x-1 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => onEdit(job)}
                        className="bg-indigo-500 hover:bg-indigo-600 text-white font-bold p-1 px-2 rounded text-[10px] transition cursor-pointer"
                      >
                        แก้ไข 📝
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete([job.Job_ID])}
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

      <ExportDateRangeModal
        isOpen={isExportModalOpen}
        startDate={exportStartDate}
        endDate={exportEndDate}
        onStartChange={setExportStartDate}
        onEndChange={setExportEndDate}
        onClose={() => setIsExportModalOpen(false)}
        onConfirm={handleConfirmExport}
      />
    </div>
  );
}
