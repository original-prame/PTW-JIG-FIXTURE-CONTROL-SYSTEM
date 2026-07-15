"use client";

import { EditingJobForm } from "@/app/types";
import { CustomerCombobox } from "@/components/CustomerCombobox";
import { ThaiDateField } from "@/components/ThaiDateField";
import { SubmitButton } from "@/components/SubmitButton";
import { PriceInput } from "@/components/PriceInput";

interface EditJobModalProps {
  isOpen: boolean;
  editingJob: EditingJobForm;
  onChange: (job: EditingJobForm) => void;
  editJobCustomerInput: string;
  onCustomerInputChange: (v: string) => void;
  customerOptions: string[];
  onClose: () => void;
  onSave: () => void;
  isSaving?: boolean;
}

export function EditJobModal({
  isOpen,
  editingJob,
  onChange,
  editJobCustomerInput,
  onCustomerInputChange,
  customerOptions,
  onClose,
  onSave,
  isSaving,
}: EditJobModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-3 sm:p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl border w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        <div className="bg-gradient-to-r from-indigo-950 via-indigo-900 to-violet-900 text-white p-4 flex justify-between items-center">
          <div>
            <h3 className="font-bold text-base text-indigo-400">📝 แก้ไขข้อมูลใบสั่งผลิต</h3>
            <p className="text-xs text-slate-400 font-mono">Job ID: {editingJob.jobId}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed font-bold text-lg cursor-pointer"
          >
            ✕
          </button>
        </div>

        <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1 text-sm">
          <CustomerCombobox
            label="ชื่อลูกค้า *"
            value={editJobCustomerInput}
            onChange={(v) => {
              onCustomerInputChange(v);
              onChange({ ...editingJob, customer: v });
            }}
            options={customerOptions}
            strictSelect
            emptyMessage="❌ ไม่มีลูกค้าชื่อนี้ในระบบ - สร้างชื่อลูกค้าใหม่ได้ที่แท็บเปิดงานผลิต"
            labelClassName="block text-xs font-bold text-slate-500 mb-1"
            triggerClassName="w-full p-2.5 border border-slate-300 rounded-lg bg-white flex justify-between items-center cursor-pointer"
          />

          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">
              รายละเอียดงาน / Model / ชิ้นงาน *
            </label>
            <input
              type="text"
              value={editingJob.desc}
              onChange={(e) => onChange({ ...editingJob, desc: e.target.value })}
              className="w-full p-2.5 border rounded-lg outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">
                จำนวนสั่งผลิต *{" "}
                {editingJob.deliveredQty > 0 && <span className="text-amber-500 ml-1">(ห้ามแก้)</span>}
              </label>
              <input
                type="number"
                min={1}
                value={editingJob.qty}
                onChange={(e) => onChange({ ...editingJob, qty: parseInt(e.target.value) || 1 })}
                disabled={editingJob.deliveredQty > 0}
                className={`w-full p-2.5 border rounded-lg outline-none text-sm ${editingJob.deliveredQty > 0 ? "bg-slate-100 text-slate-400 cursor-not-allowed select-none" : "bg-white"}`}
              />
            </div>

            <ThaiDateField
              label="📅 กำหนดส่งมอบ"
              value={editingJob.dueDate}
              onChange={(v) => onChange({ ...editingJob, dueDate: v })}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">เลขที่ใบสั่งซื้อ (PO No.)</label>
              <input
                type="text"
                value={editingJob.po}
                onChange={(e) => onChange({ ...editingJob, po: e.target.value })}
                className="w-full p-2.5 border rounded-lg outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">เลขที่ใบเสนอราคา (Quotation)</label>
              <input
                type="text"
                value={editingJob.quote}
                onChange={(e) => onChange({ ...editingJob, quote: e.target.value })}
                className="w-full p-2.5 border rounded-lg outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t pt-3 bg-slate-50 p-2.5 rounded-lg border">
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">💰 ราคาต่อหน่วย / ราคารวม</label>
              <PriceInput
                value={editingJob.price}
                onChange={(v) => onChange({ ...editingJob, price: v })}
                className="w-full pl-6 p-2 border bg-white rounded-lg outline-none text-sm"
              />
            </div>
            <ThaiDateField
              label="📅 วันที่ใบสั่งซื้อ (PO Date)"
              value={editingJob.poDate}
              onChange={(v) => onChange({ ...editingJob, poDate: v })}
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">หมายเหตุเทคนิคเพิ่มเติม</label>
            <textarea
              value={editingJob.remark}
              onChange={(e) => onChange({ ...editingJob, remark: e.target.value })}
              className="w-full p-2.5 border rounded-lg h-16 outline-none focus:ring-1 focus:ring-indigo-500"
            ></textarea>
          </div>
        </div>

        <div className="bg-slate-50 p-4 border-t flex gap-2 justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="bg-slate-300 hover:bg-slate-400 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer text-slate-700 font-bold px-4 py-2 rounded-lg text-xs transition"
          >
            ยกเลิก
          </button>
          <SubmitButton
            onClick={onSave}
            isSaving={isSaving}
            label="บันทึกการแก้ไขข้อมูล"
            className="flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer text-white font-bold px-5 py-2 rounded-lg text-xs transition shadow"
          />
        </div>
      </div>
    </div>
  );
}
