// Shared types for the PTW Production dashboard.
// Centralized here so both the API route (server) and the client
// components can import from a single source of truth without the
// client bundle depending on a route module.

export interface JobData {
  Job_ID: string;
  Release_Date: string;
  Job_Description: string;
  Qty: string;
  Customer: string;
  PO: string;
  Quotation: string;
  Due_Date: string;
  Status_Drawing: string;
  Status_Mat: string;
  Status_CNC: string;
  Status_Milling: string;
  Status_Assembly: string;
  Remark: string;
  Price?: string;
  PO_Date?: string;
  delivered_qty_total?: number;
  delivery?: DeliveryData | null;
}

export interface DeliveryData {
  Delivery_ID: string;
  Job_ID: string;
  Delivery_Date: string;
  Delivery_Note_No: string;
  Delivery_Qty: string;
  Invoice_No: string;
  Remark: string;
}

// Alias kept for the client, which historically referred to delivery
// log rows as `DeliveryLogItem`. Structurally identical to `DeliveryData`.
export type DeliveryLogItem = DeliveryData;

export type TabType =
  | "dashboard"
  | "production_table"
  | "add_job"
  | "delivery"
  | "delivery_history";

export type DeliveryFilterType = "all" | "completed" | "partial" | "pending";

export type ProductionStatusColumn =
  | "Status_Drawing"
  | "Status_Mat"
  | "Status_CNC"
  | "Status_Milling"
  | "Status_Assembly";

export interface NewJobForm {
  customer: string;
  desc: string;
  qty: number;
  dueDate: string;
  po: string;
  quote: string;
  remark: string;
  price: string;
  poDate: string;
}

export interface EditingJobForm extends NewJobForm {
  jobId: string;
  deliveredQty: number;
}

/** A single row in the multi-row "open new job" form, identified by a stable client-side id. */
export interface NewJobFormRow extends NewJobForm {
  rowId: string;
}

export interface DeliveryForm {
  jobId: string;
  delivDate: string;
  noteNo: string;
  delivQty: number;
  invoiceNo: string;
  remark: string;
}

export interface EditingDeliveryForm extends DeliveryForm {
  delivId: string;
}

/** A single row in the multi-row "record delivery" form, identified by a stable client-side id. */
export interface DeliveryFormRow extends DeliveryForm {
  rowId: string;
}

export interface SheetsGetResponse {
  success: boolean;
  data: JobData[];
  deliveryLogs?: DeliveryLogItem[];
  urgentDays?: number;
  /** Customer names saved in the Customers sheet (may be absent on older APIs). */
  customers?: string[];
}
