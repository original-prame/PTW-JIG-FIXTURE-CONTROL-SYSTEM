"use client";

import { useRef, useState } from "react";
import { NewJobForm, NewJobFormRow } from "@/app/types";
import { CustomerCombobox } from "@/components/CustomerCombobox";
import { ThaiDateField } from "@/components/ThaiDateField";
import { SubmitButton } from "@/components/SubmitButton";
import { PriceInput } from "@/components/PriceInput";
import { useToast } from "@/components/toast/ToastProvider";
import { extractTextFromPdf, OCR_PIPELINE_VERSION } from "@/lib/pdf-ocr";
import { extractJobFieldsFromText } from "@/lib/parse-job-fields";

interface AddJobTabProps {
  rows: NewJobFormRow[];
  onRowChange: (rowId: string, job: NewJobForm) => void;
  onAddRow: () => void;
  onRemoveRow: (rowId: string) => void;
  onImportRow: (fields: Partial<NewJobForm>) => void;
  customerOptions: string[];
  isAddCustomerOpen: boolean;
  onToggleAddCustomer: () => void;
  newCustomerName: string;
  onNewCustomerNameChange: (v: string) => void;
  onAddNewCustomer: () => void;
  onSubmit: () => void;
  isSaving?: boolean;
}

interface JobRowFieldsProps {
  job: NewJobForm;
  onChange: (job: NewJobForm) => void;
  customerOptions: string[];
}

/** The fields for a single job row - factored out so it can be repeated for each row in the batch. */
function JobRowFields({ job, onChange, customerOptions }: JobRowFieldsProps) {
  return (
    <div className="space-y-4">
      <CustomerCombobox
        label="ชื่อลูกค้า *"
        value={job.customer}
        onChange={(v) => onChange({ ...job, customer: v })}
        options={customerOptions}
        strictSelect
        placeholder="คลิกเลือกลูกค้าจากรายการ (พิมพ์เพื่อค้นหา)..."
        emptyMessage="❌ ไม่มีลูกค้าชื่อนี้ในระบบ - กดปุ่ม '➕ สร้างชื่อลูกค้าใหม่' ด้านบนก่อน"
        wrapperClassName=""
        labelClassName="block text-sm font-medium mb-1"
        triggerClassName="w-full p-2.5 border border-slate-300 rounded-lg bg-white flex justify-between items-center cursor-pointer text-sm focus-within:ring-1 focus-within:ring-indigo-500"
      />

      <div>
        <label className="block text-sm font-medium mb-1">รายละเอียดงาน / Model / ชิ้นงาน *</label>
        <input
          type="text"
          required
          value={job.desc}
          onChange={(e) => onChange({ ...job, desc: e.target.value })}
          className="w-full p-2.5 border rounded-lg text-sm outline-none focus:ring-1 focus:ring-indigo-500"
          placeholder="เช่น SWM PCB Cutting jig"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">จำนวนสั่งผลิต *</label>
          <input
            type="number"
            min={1}
            required
            value={job.qty}
            onChange={(e) => onChange({ ...job, qty: parseInt(e.target.value) || 1 })}
            className="w-full p-2.5 border rounded-lg text-sm outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
        <ThaiDateField
          label="📅 กำหนดส่งมอบ"
          value={job.dueDate}
          onChange={(v) => onChange({ ...job, dueDate: v })}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">เลขที่ใบสั่งซื้อ (PO No.)</label>
          <input
            type="text"
            value={job.po}
            onChange={(e) => onChange({ ...job, po: e.target.value })}
            className="w-full p-2.5 border rounded-lg text-sm outline-none focus:ring-1 focus:ring-indigo-500"
            placeholder="เช่น G1188"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">เลขที่ใบเสนอราคา (Quotation)</label>
          <input
            type="text"
            value={job.quote}
            onChange={(e) => onChange({ ...job, quote: e.target.value })}
            className="w-full p-2.5 border rounded-lg text-sm outline-none focus:ring-1 focus:ring-indigo-500"
            placeholder="เช่น PTW-1703..."
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t pt-4 bg-indigo-50/30 p-3 rounded-lg border border-indigo-100">
        <div>
          <label className="block text-sm font-semibold text-indigo-900 mb-1">💰 ราคาต่อหน่วย / ราคารวม</label>
          <PriceInput
            value={job.price}
            onChange={(v) => onChange({ ...job, price: v })}
            className="w-full pl-6 p-2.5 border rounded-lg text-sm outline-none bg-white focus:ring-1 focus:ring-indigo-500"
            placeholder="เช่น 15,000"
          />
        </div>
        <ThaiDateField
          label="📅 วันที่ใบสั่งซื้อ (PO Date)"
          value={job.poDate}
          onChange={(v) => onChange({ ...job, poDate: v })}
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">หมายเหตุเทคนิคเพิ่มเติม</label>
        <textarea
          value={job.remark}
          onChange={(e) => onChange({ ...job, remark: e.target.value })}
          className="w-full p-2.5 border rounded-lg h-20 text-sm outline-none focus:ring-1 focus:ring-indigo-500"
        ></textarea>
      </div>
    </div>
  );
}

export function AddJobTab({
  rows,
  onRowChange,
  onAddRow,
  onRemoveRow,
  onImportRow,
  customerOptions,
  isAddCustomerOpen,
  onToggleAddCustomer,
  newCustomerName,
  onNewCustomerNameChange,
  onAddNewCustomer,
  onSubmit,
  isSaving,
}: AddJobTabProps) {
  const { showToast, updateToast } = useToast();
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePdfFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      showToast("กรุณาเลือกไฟล์ PDF เท่านั้น", "warning");
      return;
    }

    setIsImporting(true);
    const toastId = showToast("กำลังอ่านไฟล์ PDF...", "loading");
    try {
      const text = await extractTextFromPdf(file, (message) =>
        updateToast(toastId, { message, variant: "loading" }),
      );
      // A single PO/quotation PDF can list more than one line item - each
      // detected item comes back as its own row, sharing the document-level
      // fields (customer/PO/quotation) but with its own description/qty/
      // price/due date.
      const importedRows = extractJobFieldsFromText(text, file.name);
      importedRows.forEach(({ fields }) => onImportRow(fields));

      const rowsWithMissing = importedRows.filter((r) => r.missingFields.length > 0);
      const itemWord = importedRows.length > 1 ? `${importedRows.length} รายการ` : "1 รายการ";

      if (rowsWithMissing.length === 0) {
        updateToast(toastId, {
          message: `นำเข้าข้อมูลจาก PDF สำเร็จ (${itemWord})! กรุณาตรวจสอบความถูกต้องอีกครั้งก่อนบันทึก`,
          variant: "success",
        });
      } else {
        const allMissing = Array.from(new Set(rowsWithMissing.flatMap((r) => r.missingFields)));
        updateToast(toastId, {
          message: `นำเข้าข้อมูลจาก PDF ${itemWord} บางส่วนไม่ครบ - ไม่พบข้อมูล: ${allMissing.join(", ")} กรุณาตรวจสอบและกรอกเพิ่มเติมในรายการที่เพิ่มใหม่`,
          variant: "warning",
        });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      updateToast(toastId, { message: "อ่านไฟล์ PDF ไม่สำเร็จ: " + message, variant: "error" });
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="max-w-2xl bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow duration-200 space-y-5 mx-auto">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 border-b pb-2">
        <h2 className="text-lg font-bold text-slate-700">📋 กรอกข้อมูลเพื่อเปิดงานผลิตใหม่</h2>
        <div className="flex flex-wrap gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={handlePdfFileSelected}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isImporting}
            title="อ่านไฟล์ PDF (เช่น ใบสั่งซื้อ) แล้วคีย์ข้อมูลลงฟอร์มให้อัตโนมัติด้วยระบบ OCR"
            className="self-start sm:self-auto text-xs bg-violet-50 text-violet-600 hover:bg-violet-100 disabled:opacity-60 disabled:cursor-not-allowed px-2.5 py-1.5 rounded-md font-bold transition cursor-pointer"
          >
            {isImporting ? "⏳ กำลังอ่าน PDF..." : `📄 นำเข้าจาก PDF`}
          </button>
          <button
            type="button"
            onClick={onToggleAddCustomer}
            className="self-start sm:self-auto text-xs bg-indigo-50 text-indigo-600 hover:bg-indigo-100 px-2.5 py-1.5 rounded-md font-bold transition cursor-pointer"
          >
            {isAddCustomerOpen ? "✕ ปิดฟอร์มสร้างรายชื่อ" : "➕ สร้างชื่อลูกค้าใหม่"}
          </button>
        </div>
      </div>

      {isAddCustomerOpen && (
        <div className="p-4 bg-slate-50 border border-indigo-200 rounded-lg space-y-2">
          <h3 className="text-xs font-bold text-indigo-800 uppercase">🏢 เพิ่มรายชื่อลูกค้าใหม่ในระบบคีย์</h3>
          <div className="flex gap-2">
            <input
              type="text"
              value={newCustomerName}
              onChange={(e) => onNewCustomerNameChange(e.target.value)}
              placeholder="พิมพ์ชื่อลูกค้าใหม่ที่นี่..."
              className="w-full p-2 border bg-white rounded-md text-sm outline-none focus:border-indigo-500 font-medium"
            />
            <button
              type="button"
              onClick={onAddNewCustomer}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 rounded-md text-sm transition shrink-0 cursor-pointer"
            >
              บันทึกชื่อ
            </button>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {rows.map((row, idx) => (
          <div key={row.rowId} className="border border-slate-200 rounded-2xl p-4 bg-slate-50/40 space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-indigo-600 uppercase bg-indigo-50 px-2.5 py-1 rounded-full">
                📦 รายการที่ {idx + 1}
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
            <JobRowFields
              job={row}
              onChange={(job) => onRowChange(row.rowId, job)}
              customerOptions={customerOptions}
            />
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={onAddRow}
        className="w-full border-2 border-dashed border-indigo-300 text-indigo-600 hover:bg-indigo-50 font-bold py-2.5 rounded-xl text-sm transition cursor-pointer"
      >
        ➕ เพิ่มอีกรายการ
      </button>

      <SubmitButton
        onClick={onSubmit}
        isSaving={isSaving}
        label={`🚀 บันทึกทั้งหมด (${rows.length} รายการ) ลง Google Sheets`}
      />
    </div>
  );
}
