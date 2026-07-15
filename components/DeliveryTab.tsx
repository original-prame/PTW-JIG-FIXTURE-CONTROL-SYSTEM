"use client";

import { useRef, useState } from "react";
import { DeliveryForm, DeliveryFormRow, JobData } from "@/app/types";
import { ThaiDateField } from "@/components/ThaiDateField";
import { SubmitButton } from "@/components/SubmitButton";
import { useOutsideClick } from "@/hooks/useOutsideClick";
import { filterPendingDeliveryJobs } from "@/lib/dashboard-calculations";

interface DeliveryTabProps {
  rows: DeliveryFormRow[];
  onRowChange: (rowId: string, delivery: DeliveryForm) => void;
  onAddRow: () => void;
  onRemoveRow: (rowId: string) => void;
  /** Full job list (unfiltered by search), used to look up outstanding quantities and to search against. */
  allJobs: JobData[];
  onSubmit: () => void;
  isSaving?: boolean;
}

function outstandingQtyForJob(job: JobData): number {
  return (parseInt(job.Qty) || 0) - (job.delivered_qty_total || 0);
}

interface DeliveryRowFieldsProps {
  delivery: DeliveryForm;
  onChange: (delivery: DeliveryForm) => void;
  allJobs: JobData[];
}

/** The fields for a single delivery row, including its own independent job-search dropdown state. */
function DeliveryRowFields({ delivery, onChange, allJobs }: DeliveryRowFieldsProps) {
  const [isJobDropdownOpen, setIsJobDropdownOpen] = useState(false);
  const [jobSearch, setJobSearch] = useState<string>(() => {
    const job = allJobs.find((j) => j.Job_ID === delivery.jobId);
    return job ? `[${job.Job_ID}] ${job.Customer} - ${job.Job_Description}` : "";
  });
  const jobDropdownRef = useRef<HTMLDivElement>(null);
  useOutsideClick(jobDropdownRef, () => setIsJobDropdownOpen(false));

  const pendingDeliveryJobs = filterPendingDeliveryJobs(allJobs, jobSearch);
  const selectedJob = allJobs.find((j) => j.Job_ID === delivery.jobId);
  const maxQty = selectedJob ? outstandingQtyForJob(selectedJob) : undefined;

  return (
    <div className="space-y-4">
      <div className="relative" ref={jobDropdownRef}>
        <label className="block text-sm font-medium mb-1">🔍 เลือกรายการงานผลิตที่ค้างส่ง *</label>
        <div
          onClick={() => setIsJobDropdownOpen(true)}
          className="w-full p-2.5 border border-slate-300 rounded-lg bg-slate-50 flex justify-between items-center cursor-pointer text-sm"
        >
          <input
            type="text"
            value={jobSearch}
            onChange={(e) => {
              setJobSearch(e.target.value);
              setIsJobDropdownOpen(true);
            }}
            placeholder="พิมพ์คำค้นหา..."
            className="w-full bg-transparent outline-none text-sm font-semibold text-slate-800"
          />
          <span className="text-slate-400 text-xs">▼</span>
        </div>
        {isJobDropdownOpen && (
          <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl max-h-60 overflow-y-auto">
            {pendingDeliveryJobs.map((j) => (
              <div
                key={j.Job_ID}
                onClick={() => {
                  const outstanding = outstandingQtyForJob(j);
                  onChange({
                    ...delivery,
                    jobId: j.Job_ID,
                    // Clamp any already-entered qty down to the newly selected job's outstanding amount.
                    delivQty: Math.min(delivery.delivQty, outstanding) || 1,
                  });
                  setJobSearch(`[${j.Job_ID}] ${j.Customer} - ${j.Job_Description}`);
                  setIsJobDropdownOpen(false);
                }}
                className="group p-3 text-xs border-b hover:bg-indigo-500 hover:text-white cursor-pointer flex flex-col"
              >
                <div className="flex justify-between font-bold">
                  <span>🆔 Job: {j.Job_ID}</span>
                  <span className="text-amber-600 bg-amber-100 rounded px-1 text-[10px] font-black">
                    ค้าง {(parseInt(j.Qty) || 0) - (j.delivered_qty_total || 0)} ชิ้น
                  </span>
                </div>
                <div className="font-semibold mt-1">
                  🏢 ลูกค้า: {j.Customer} (PO: {j.PO || "-"})
                </div>
                <div className="text-slate-500 group-hover:text-white mt-0.5 truncate">
                  📦 ชื่อรายการ: {j.Job_Description}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">
            จำนวนชิ้นที่ส่งรอบนี้ *
            {maxQty !== undefined && <span className="text-slate-400 font-normal"> (คงค้าง {maxQty} ชิ้น)</span>}
          </label>
          <input
            type="number"
            min={1}
            max={maxQty}
            required
            value={delivery.delivQty}
            onChange={(e) => {
              const raw = parseInt(e.target.value) || 1;
              const clamped = maxQty !== undefined ? Math.min(raw, maxQty) : raw;
              onChange({ ...delivery, delivQty: Math.max(1, clamped) });
            }}
            className="w-full p-2.5 border rounded-lg text-sm outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        <ThaiDateField
          label="📅 วันที่ส่งของจริง"
          value={delivery.delivDate}
          onChange={(v) => onChange({ ...delivery, delivDate: v })}
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">เลขที่ใบส่งของชั่วคราว *</label>
        <input
          type="text"
          required
          value={delivery.noteNo}
          onChange={(e) => onChange({ ...delivery, noteNo: e.target.value })}
          className="w-full p-2.5 border rounded-lg text-sm outline-none focus:ring-1 focus:ring-indigo-500"
          placeholder="เช่น 0204"
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">เลขที่ใบกำกับภาษี / Invoice (ถ้ามี)</label>
        <input
          type="text"
          value={delivery.invoiceNo}
          onChange={(e) => onChange({ ...delivery, invoiceNo: e.target.value })}
          className="w-full p-2.5 border rounded-lg text-sm outline-none focus:ring-1 focus:ring-indigo-500"
          placeholder="เช่น IV610"
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">หมายเหตุบันทึกจัดส่ง</label>
        <textarea
          value={delivery.remark}
          onChange={(e) => onChange({ ...delivery, remark: e.target.value })}
          className="w-full p-2.5 border rounded-lg h-20 text-sm outline-none focus:ring-1 focus:ring-indigo-500"
          placeholder="ระบุข้อมูลเพิ่มเติม..."
        ></textarea>
      </div>
    </div>
  );
}

export function DeliveryTab({
  rows,
  onRowChange,
  onAddRow,
  onRemoveRow,
  allJobs,
  onSubmit,
  isSaving,
}: DeliveryTabProps) {
  return (
    <div className="max-w-2xl bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow duration-200 space-y-5 mx-auto">
      <h2 className="text-lg font-bold border-b pb-2 text-slate-700">📦 บันทึกการส่งมอบสินค้า</h2>

      <div className="space-y-4">
        {rows.map((row, idx) => (
          <div key={row.rowId} className="border border-slate-200 rounded-2xl p-4 bg-slate-50/40 space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-violet-600 uppercase bg-violet-50 px-2.5 py-1 rounded-full">
                🚚 รายการที่ {idx + 1}
              </span>
              {rows.length > 1 && (
                <button
                  type="button"
                  onClick={() => onRemoveRow(row.rowId)}
                  className="text-xs text-red-500 hover:text-red-700 font-bold transition cursor-pointer"
                >
                  🗑️ ลบรายการนี้
                </button>
              )}
            </div>
            <DeliveryRowFields delivery={row} onChange={(d) => onRowChange(row.rowId, d)} allJobs={allJobs} />
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={onAddRow}
        className="w-full border-2 border-dashed border-violet-300 text-violet-600 hover:bg-violet-50 font-bold py-2.5 rounded-xl text-sm transition cursor-pointer"
      >
        ➕ เพิ่มอีกรายการ
      </button>

      <SubmitButton
        onClick={onSubmit}
        isSaving={isSaving}
        label={`💾 บันทึกทั้งหมด (${rows.length} รายการ) เข้า Google Sheets`}
      />
    </div>
  );
}
