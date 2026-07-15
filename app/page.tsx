"use client";

import { useState } from "react";
import axios from "axios";
import {
  TabType,
  DeliveryFilterType,
  JobData,
  DeliveryLogItem,
  NewJobForm,
  NewJobFormRow,
  EditingJobForm,
  DeliveryForm,
  DeliveryFormRow,
  EditingDeliveryForm,
} from "./types";
import {
  convertToThaiDateFormat,
  convertThaiDateToIso,
  defaultFinancialRange,
  getTodayIso,
} from "@/lib/thai-date";
import { filterProductionData } from "@/lib/dashboard-calculations";
import { useJobsData } from "@/hooks/useJobsData";
import { useToast } from "@/components/toast/ToastProvider";
import { Header } from "@/components/Header";
import { TabNav } from "@/components/TabNav";
import { Loader } from "@/components/Loader";
import { DashboardTab } from "@/components/dashboard/DashboardTab";
import { ProductionTableTab } from "@/components/ProductionTableTab";
import { AddJobTab } from "@/components/AddJobTab";
import { DeliveryTab } from "@/components/DeliveryTab";
import { DeliveryHistoryTab } from "@/components/DeliveryHistoryTab";
import { EditJobModal } from "@/components/EditJobModal";
import { EditDeliveryModal } from "@/components/EditDeliveryModal";
import { ConfirmModal } from "@/components/ConfirmModal";

const { start: defaultStartDateStr, end: defaultEndDateStr } = defaultFinancialRange();
const todayIso = getTodayIso();

const emptyNewJob: NewJobForm = {
  customer: "",
  desc: "",
  qty: 1,
  dueDate: todayIso,
  po: "",
  quote: "",
  remark: "",
  price: "",
  poDate: todayIso,
};

const emptyDelivery: DeliveryForm = {
  jobId: "",
  delivDate: todayIso,
  noteNo: "",
  delivQty: 1,
  invoiceNo: "",
  remark: "",
};

type DeleteTarget =
  | { type: "job"; ids: string[]; message: string }
  | { type: "delivery"; ids: string[]; message: string };

const SAVING_MESSAGE = "กำลังบันทึกข้อมูล...";

/** Stable client-side id for a batch-form row (works even outside a secure context, where crypto.randomUUID may be unavailable). */
function makeRowId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `row-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function makeJobRow(): NewJobFormRow {
  return { ...emptyNewJob, rowId: makeRowId() };
}

function makeDeliveryRow(): DeliveryFormRow {
  return { ...emptyDelivery, rowId: makeRowId() };
}

export default function AdvancedDashboard() {
  const {
    data,
    setData,
    deliveryLogs,
    loading,
    setLoading,
    urgentDaysConfig,
    customCustomerList,
    addCustomer,
    fetchData,
  } = useJobsData();

  const { showToast, updateToast } = useToast();

  const [activeTab, setActiveTab] = useState<TabType>("dashboard");

  const [financialStartDate, setFinancialStartDate] = useState<string>(defaultStartDateStr);
  const [financialEndDate, setFinancialEndDate] = useState<string>(defaultEndDateStr);

  const [searchTerm, setSearchTerm] = useState<string>("");
  const [deliverySearchTerm, setDeliverySearchTerm] = useState<string>("");
  const [customerFilterInput, setCustomerFilterInput] = useState<string>("");
  const [deliveryStatusFilter, setDeliveryStatusFilter] = useState<DeliveryFilterType>("all");

  const [newCustomerName, setNewCustomerName] = useState<string>("");
  const [isAddCustomerOpen, setIsAddCustomerOpen] = useState<boolean>(false);

  const [newJobRows, setNewJobRows] = useState<NewJobFormRow[]>(() => [makeJobRow()]);
  const [deliveryRows, setDeliveryRows] = useState<DeliveryFormRow[]>(() => [makeDeliveryRow()]);

  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [editingJob, setEditingJob] = useState<EditingJobForm>({ ...emptyNewJob, jobId: "", deliveredQty: 0 });
  const [editJobCustomerInput, setEditJobCustomerInput] = useState<string>("");

  const [isEditDelivModalOpen, setIsEditDelivModalOpen] = useState<boolean>(false);
  const [editingDeliv, setEditingDeliv] = useState<EditingDeliveryForm>({ ...emptyDelivery, delivId: "" });

  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Selection-only customer fields are enforced in the UI, but validate
  // again before saving in case a value slipped through (e.g. imported
  // from a PDF whose customer isn't in the system yet).
  const isKnownCustomer = (name: string) =>
    customCustomerList.some((c) => c.trim().toLowerCase() === name.trim().toLowerCase());

  const handleAddNewCustomer = () => {
    const name = newCustomerName.trim();
    if (!name) return showToast("กรุณากรอกชื่อลูกค้า", "warning");
    if (customCustomerList.includes(name)) return showToast("มีรายชื่อลูกค้านี้อยู่แล้วในระบบ", "warning");

    // Fire-and-forget: persists to the Customers sheet in the background
    // (failure shows its own toast from useJobsData).
    void addCustomer(name);
    // Auto-fill the newly created customer into the row the user was most
    // likely working on (the last one in the batch).
    setNewJobRows((prev) =>
      prev.map((row, i) => (i === prev.length - 1 ? { ...row, customer: name } : row)),
    );
    setNewCustomerName("");
    setIsAddCustomerOpen(false);
    showToast(`เพิ่มลูกค้า "${name}" แล้ว`, "success");
  };

  const handleSelectStatusChange = async (jobId: string, column: string, nextVal: string) => {
    try {
      await axios.post("/sheets", { action: "UPDATE_STATUS", jobId, column, newValue: nextVal });
      setData((prev) =>
        prev.map((job) => (job.Job_ID === jobId ? { ...job, [column]: nextVal } : job)),
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      showToast("ไม่สามารถอัปเดตสถานะได้: " + message, "error");
    }
  };

  const openEditModal = (job: JobData) => {
    const isoDueDate = convertThaiDateToIso(job.Due_Date);
    const isoPODate = job.PO_Date ? convertThaiDateToIso(job.PO_Date) : "";
    setEditingJob({
      jobId: job.Job_ID,
      customer: job.Customer,
      desc: job.Job_Description,
      qty: parseInt(job.Qty) || 1,
      dueDate: isoDueDate,
      po: job.PO || "",
      quote: job.Quotation || "",
      remark: job.Remark || "",
      price: job.Price || "",
      poDate: isoPODate,
      deliveredQty: job.delivered_qty_total || 0,
    });
    setEditJobCustomerInput(job.Customer);
    setIsEditModalOpen(true);
  };

  const handleUpdateJob = async () => {
    if (!isKnownCustomer(editingJob.customer))
      return showToast(
        `ไม่มีลูกค้า "${editingJob.customer}" ในระบบ กรุณาสร้างชื่อลูกค้าใหม่ก่อน (แท็บเปิดงานผลิต)`,
        "warning",
      );
    if (!editingJob.customer || !editingJob.desc || !editingJob.dueDate)
      return showToast("กรุณากรอกข้อมูลสำคัญให้ครบถ้วน", "warning");

    const toastId = showToast(SAVING_MESSAGE, "loading");
    try {
      setIsSaving(true);
      setLoading(true);
      const formattedThaiDueDate = convertToThaiDateFormat(editingJob.dueDate);
      const formattedThaiPODate = editingJob.poDate ? convertToThaiDateFormat(editingJob.poDate) : "";

      await axios.post("/sheets", {
        action: "UPDATE_JOB",
        ...editingJob,
        dueDate: formattedThaiDueDate,
        poDate: formattedThaiPODate,
      });
      // Close the modal before showing success, so it doesn't look like
      // the modal is "stuck" open behind the toast.
      setIsEditModalOpen(false);
      updateToast(toastId, { message: `แก้ไขข้อมูล Job: ${editingJob.jobId} สำเร็จ!`, variant: "success" });
      fetchData();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      updateToast(toastId, { message, variant: "error" });
      setLoading(false);
    } finally {
      setIsSaving(false);
    }
  };

  const requestDeleteJob = (jobIds: string[]) => {
    if (jobIds.length === 0) return;
    setDeleteTarget({
      type: "job",
      ids: jobIds,
      message:
        jobIds.length === 1
          ? `คุณแน่ใจหรือไม่ว่าต้องการ "ลบข้อมูล" ใบสั่งผลิตรหัส ${jobIds[0]} ถาวร?`
          : `คุณแน่ใจหรือไม่ว่าต้องการ "ลบข้อมูล" ใบสั่งผลิตทั้งหมด ${jobIds.length} รายการถาวร?`,
    });
  };

  const handleAddJobRow = () => setNewJobRows((prev) => [...prev, makeJobRow()]);

  const handleRemoveJobRow = (rowId: string) =>
    setNewJobRows((prev) => (prev.length > 1 ? prev.filter((r) => r.rowId !== rowId) : prev));

  const handleJobRowChange = (rowId: string, job: NewJobForm) =>
    setNewJobRows((prev) => prev.map((r) => (r.rowId === rowId ? { ...job, rowId } : r)));

  // Appends a new row pre-filled from a PDF/OCR import, rather than
  // overwriting whatever the user may already be typing into other rows.
  const handleImportJobRow = (fields: Partial<NewJobForm>) =>
    setNewJobRows((prev) => [...prev, { ...emptyNewJob, ...fields, rowId: makeRowId() }]);

  const handleAddJobs = async () => {
    const unknownCustomerRow = newJobRows.findIndex(
      (row) => row.customer && !isKnownCustomer(row.customer),
    );
    if (unknownCustomerRow !== -1) {
      return showToast(
        `รายการที่ ${unknownCustomerRow + 1}: ไม่มีลูกค้า "${newJobRows[unknownCustomerRow].customer}" ในระบบ กรุณากดปุ่ม '➕ สร้างชื่อลูกค้าใหม่' ก่อนบันทึก`,
        "warning",
      );
    }
    const invalidIndex = newJobRows.findIndex((row) => !row.customer || !row.desc || !row.dueDate);
    if (invalidIndex !== -1)
      return showToast(
        `กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน (รายการที่ ${invalidIndex + 1}: ลูกค้า, รายละเอียดงาน, กำหนดส่งมอบ)`,
        "warning",
      );

    const toastId = showToast(SAVING_MESSAGE, "loading");
    setIsSaving(true);
    let successCount = 0;
    const failedRows: string[] = [];

    for (let i = 0; i < newJobRows.length; i++) {
      const row = newJobRows[i];
      try {
        const formattedThaiDueDate = convertToThaiDateFormat(row.dueDate);
        const formattedThaiPODate = row.poDate ? convertToThaiDateFormat(row.poDate) : "";
        await axios.post("/sheets", {
          action: "ADD_JOB",
          ...row,
          dueDate: formattedThaiDueDate,
          poDate: formattedThaiPODate,
        });
        successCount++;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        failedRows.push(`รายการที่ ${i + 1} (${row.desc || row.customer}): ${message}`);
      }
    }

    if (failedRows.length === 0) {
      updateToast(toastId, { message: `เปิด Job งานผลิตใหม่สำเร็จทั้งหมด ${successCount} รายการ!`, variant: "success" });
      setNewJobRows([makeJobRow()]);
      fetchData();
      setActiveTab("dashboard");
    } else {
      updateToast(toastId, {
        message: `บันทึกสำเร็จ ${successCount}/${newJobRows.length} รายการ - ล้มเหลว: ${failedRows.join(" | ")}`,
        variant: successCount > 0 ? "warning" : "error",
      });
      if (successCount > 0) fetchData();
    }
    setIsSaving(false);
  };

  const handleAddDeliveryRow = () => setDeliveryRows((prev) => [...prev, makeDeliveryRow()]);

  const handleRemoveDeliveryRow = (rowId: string) =>
    setDeliveryRows((prev) => (prev.length > 1 ? prev.filter((r) => r.rowId !== rowId) : prev));

  const handleDeliveryRowChange = (rowId: string, delivery: DeliveryForm) =>
    setDeliveryRows((prev) => prev.map((r) => (r.rowId === rowId ? { ...delivery, rowId } : r)));

  const handleDeliverJobs = async () => {
    const invalidIndex = deliveryRows.findIndex(
      (row) => !row.jobId || !row.delivDate || !row.noteNo || row.delivQty <= 0,
    );
    if (invalidIndex !== -1)
      return showToast(`กรุณากรอกข้อมูลให้ครบถ้วน (รายการที่ ${invalidIndex + 1})`, "warning");

    const toastId = showToast(SAVING_MESSAGE, "loading");
    setIsSaving(true);
    let successCount = 0;
    const failedRows: string[] = [];

    for (let i = 0; i < deliveryRows.length; i++) {
      const row = deliveryRows[i];
      try {
        const formattedThaiDate = convertToThaiDateFormat(row.delivDate);
        await axios.post("/sheets", { action: "DELIVER_JOB", ...row, delivDate: formattedThaiDate });
        successCount++;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        failedRows.push(`รายการที่ ${i + 1} (${row.jobId}): ${message}`);
      }
    }

    if (failedRows.length === 0) {
      updateToast(toastId, { message: `บันทึกประวัติสำเร็จทั้งหมด ${successCount} รายการ!`, variant: "success" });
      setDeliveryRows([makeDeliveryRow()]);
      fetchData();
      setActiveTab("dashboard");
    } else {
      updateToast(toastId, {
        message: `บันทึกสำเร็จ ${successCount}/${deliveryRows.length} รายการ - ล้มเหลว: ${failedRows.join(" | ")}`,
        variant: successCount > 0 ? "warning" : "error",
      });
      if (successCount > 0) fetchData();
    }
    setIsSaving(false);
  };

  const openEditDelivModal = (log: DeliveryLogItem) => {
    setEditingDeliv({
      delivId: log.Delivery_ID,
      jobId: log.Job_ID,
      delivDate: convertThaiDateToIso(log.Delivery_Date),
      noteNo: log.Delivery_Note_No,
      delivQty: parseInt(log.Delivery_Qty) || 1,
      invoiceNo: log.Invoice_No || "",
      remark: log.Remark || "",
    });
    setIsEditDelivModalOpen(true);
  };

  const handleUpdateDelivery = async () => {
    if (!editingDeliv.delivDate || !editingDeliv.noteNo || editingDeliv.delivQty <= 0)
      return showToast("กรุณากรอกข้อมูลประวัติจัดส่งให้ครบถ้วน", "warning");

    const toastId = showToast(SAVING_MESSAGE, "loading");
    try {
      setIsSaving(true);
      setLoading(true);
      const formattedThaiDate = convertToThaiDateFormat(editingDeliv.delivDate);
      await axios.post("/sheets", { action: "UPDATE_DELIVERY", ...editingDeliv, delivDate: formattedThaiDate });
      // Close the modal before showing success, so it doesn't look like
      // the modal is "stuck" open behind the toast.
      setIsEditDelivModalOpen(false);
      updateToast(toastId, { message: `แก้ไขประวัติส่งมอบ ${editingDeliv.delivId} สำเร็จ`, variant: "success" });
      fetchData();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      updateToast(toastId, { message: "แก้ไขล้มเหลว: " + message, variant: "error" });
      setLoading(false);
    } finally {
      setIsSaving(false);
    }
  };

  const requestDeleteDelivery = (delivIds: string[]) => {
    if (delivIds.length === 0) return;
    setDeleteTarget({
      type: "delivery",
      ids: delivIds,
      message:
        delivIds.length === 1
          ? `คุณแน่ใจหรือไม่ว่าต้องการ "ลบประวัติการจัดส่ง" รหัส ${delivIds[0]} ถาวร?`
          : `คุณแน่ใจหรือไม่ว่าต้องการ "ลบประวัติการจัดส่ง" ทั้งหมด ${delivIds.length} รายการถาวร?`,
    });
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    const { type, ids } = deleteTarget;
    setDeleteTarget(null);

    const toastId = showToast(SAVING_MESSAGE, "loading");
    setIsSaving(true);
    setLoading(true);
    let successCount = 0;
    const failedIds: string[] = [];

    for (const id of ids) {
      try {
        if (type === "job") {
          await axios.post("/sheets", { action: "DELETE_JOB", jobId: id });
        } else {
          await axios.post("/sheets", { action: "DELETE_DELIVERY", delivId: id });
        }
        successCount++;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        failedIds.push(`${id}: ${message}`);
      }
    }

    const label = type === "job" ? "ใบสั่งผลิต" : "ประวัติจัดส่ง";
    if (failedIds.length === 0) {
      updateToast(toastId, {
        message: ids.length === 1 ? `ลบ${label}รหัส ${ids[0]} สำเร็จเรียบร้อย` : `ลบ${label}สำเร็จทั้งหมด ${successCount} รายการ`,
        variant: "success",
      });
    } else {
      updateToast(toastId, {
        message: `ลบสำเร็จ ${successCount}/${ids.length} รายการ - ล้มเหลว: ${failedIds.join(" | ")}`,
        variant: successCount > 0 ? "warning" : "error",
      });
    }

    if (successCount > 0) {
      fetchData();
    } else {
      setLoading(false);
    }
    setIsSaving(false);
  };

  const filteredData = filterProductionData(data, searchTerm, customerFilterInput, deliveryStatusFilter);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-100 to-indigo-50 text-slate-800 font-sans">
      <Header onRefresh={fetchData} />
      <TabNav activeTab={activeTab} onChange={setActiveTab} />

      <main className="p-3 sm:p-6 space-y-6">
        {loading ? (
          <Loader />
        ) : (
          <>
            {activeTab === "dashboard" && (
              <DashboardTab
                data={data}
                urgentDaysConfig={urgentDaysConfig}
                financialStartDate={financialStartDate}
                financialEndDate={financialEndDate}
                onFinancialStartChange={setFinancialStartDate}
                onFinancialEndChange={setFinancialEndDate}
                onFinancialClear={() => {
                  setFinancialStartDate("");
                  setFinancialEndDate("");
                }}
              />
            )}

            {activeTab === "production_table" && (
              <ProductionTableTab
                filteredData={filteredData}
                searchTerm={searchTerm}
                onSearchTermChange={setSearchTerm}
                customerFilterInput={customerFilterInput}
                onCustomerFilterChange={setCustomerFilterInput}
                customerOptions={customCustomerList}
                deliveryStatusFilter={deliveryStatusFilter}
                onDeliveryStatusFilterChange={setDeliveryStatusFilter}
                onStatusChange={handleSelectStatusChange}
                onEdit={openEditModal}
                onDelete={requestDeleteJob}
              />
            )}

            {activeTab === "add_job" && (
              <AddJobTab
                rows={newJobRows}
                onRowChange={handleJobRowChange}
                onAddRow={handleAddJobRow}
                onRemoveRow={handleRemoveJobRow}
                onImportRow={handleImportJobRow}
                customerOptions={customCustomerList}
                isAddCustomerOpen={isAddCustomerOpen}
                onToggleAddCustomer={() => setIsAddCustomerOpen(!isAddCustomerOpen)}
                newCustomerName={newCustomerName}
                onNewCustomerNameChange={setNewCustomerName}
                onAddNewCustomer={handleAddNewCustomer}
                onSubmit={handleAddJobs}
                isSaving={isSaving}
              />
            )}

            {activeTab === "delivery" && (
              <DeliveryTab
                rows={deliveryRows}
                onRowChange={handleDeliveryRowChange}
                onAddRow={handleAddDeliveryRow}
                onRemoveRow={handleRemoveDeliveryRow}
                allJobs={data}
                onSubmit={handleDeliverJobs}
                isSaving={isSaving}
              />
            )}

            {activeTab === "delivery_history" && (
              <DeliveryHistoryTab
                deliveryLogs={deliveryLogs}
                jobs={data}
                searchTerm={deliverySearchTerm}
                onSearchTermChange={setDeliverySearchTerm}
                onEdit={openEditDelivModal}
                onDelete={requestDeleteDelivery}
              />
            )}
          </>
        )}
      </main>

      <EditJobModal
        isOpen={isEditModalOpen}
        editingJob={editingJob}
        onChange={setEditingJob}
        editJobCustomerInput={editJobCustomerInput}
        onCustomerInputChange={setEditJobCustomerInput}
        customerOptions={customCustomerList}
        onClose={() => setIsEditModalOpen(false)}
        onSave={handleUpdateJob}
        isSaving={isSaving}
      />

      <EditDeliveryModal
        isOpen={isEditDelivModalOpen}
        editingDeliv={editingDeliv}
        onChange={setEditingDeliv}
        onClose={() => setIsEditDelivModalOpen(false)}
        onSave={handleUpdateDelivery}
        isSaving={isSaving}
      />

      <ConfirmModal
        isOpen={deleteTarget !== null}
        title={deleteTarget?.type === "job" ? "ยืนยันการลบใบสั่งผลิต" : "ยืนยันการลบประวัติจัดส่ง"}
        message={deleteTarget?.message ?? ""}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
