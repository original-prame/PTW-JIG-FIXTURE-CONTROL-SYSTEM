"use client";

import { EditingDeliveryForm } from "@/app/types";
import { ThaiDateField } from "@/components/ThaiDateField";
import { SubmitButton } from "@/components/SubmitButton";

interface EditDeliveryModalProps {
  isOpen: boolean;
  editingDeliv: EditingDeliveryForm;
  onChange: (deliv: EditingDeliveryForm) => void;
  onClose: () => void;
  onSave: () => void;
  isSaving?: boolean;
}

export function EditDeliveryModal({
  isOpen,
  editingDeliv,
  onChange,
  onClose,
  onSave,
  isSaving,
}: EditDeliveryModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-3 sm:p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl border w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        <div className="bg-gradient-to-r from-indigo-950 via-indigo-900 to-violet-900 text-white p-4 flex justify-between items-center">
          <div>
            <h3 className="font-bold text-base text-violet-400">🚚 แก้ไขประวัติส่งมอบงาน</h3>
            <p className="text-xs text-slate-400 font-mono">
              ID: {editingDeliv.delivId} (Job: {editingDeliv.jobId})
            </p>
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
          <ThaiDateField
            label="📅 วันที่จัดส่งจริง"
            value={editingDeliv.delivDate}
            onChange={(v) => onChange({ ...editingDeliv, delivDate: v })}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">เลขใบส่งของ (Note No.)</label>
              <input
                type="text"
                value={editingDeliv.noteNo}
                onChange={(e) => onChange({ ...editingDeliv, noteNo: e.target.value })}
                className="w-full p-2.5 border rounded-lg outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">จำนวนที่ส่ง (Pcs.)</label>
              <input
                type="number"
                min={1}
                value={editingDeliv.delivQty}
                onChange={(e) => onChange({ ...editingDeliv, delivQty: parseInt(e.target.value) || 1 })}
                className="w-full p-2.5 border rounded-lg outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">เลขใบกำกับภาษี (Invoice No.)</label>
            <input
              type="text"
              value={editingDeliv.invoiceNo}
              onChange={(e) => onChange({ ...editingDeliv, invoiceNo: e.target.value })}
              className="w-full p-2.5 border rounded-lg outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">หมายเหตุ</label>
            <textarea
              value={editingDeliv.remark}
              onChange={(e) => onChange({ ...editingDeliv, remark: e.target.value })}
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
            label="บันทึกประวัติส่งมอบ"
            className="flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer text-white font-bold px-5 py-2 rounded-lg text-xs transition shadow"
          />
        </div>
      </div>
    </div>
  );
}
