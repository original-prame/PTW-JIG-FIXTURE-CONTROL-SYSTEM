// Pure calculation helpers extracted from the dashboard component.
// None of these touch React state - they take the current `data` (and
// any filter inputs) and return derived values, which keeps them easy
// to unit test independently of the UI.

import { JobData, DeliveryFilterType } from "@/app/types";
import { THAI_MONTHS, parseThaiDateToObj } from "@/lib/thai-date";

export type DeptKey = "Drawing" | "Mat" | "CNC" | "Milling" | "Assembly";

export type DeptStats = Record<DeptKey, { ok: number; wip: number; none: number; wait: number }>;

export interface ProductionSummary {
  totalJobs: number;
  totalOrderedQty: number;
  totalDeliveredQty: number;
  deptStats: DeptStats;
  deliveryFullyOk: number;
  deliveryPartial: number;
  deliveryWaiting: number;
  incompleteDeliveries: JobData[];
  urgentJobs: JobData[];
}

const EMPTY_DEPT_STATS = (): DeptStats => ({
  Drawing: { ok: 0, wip: 0, none: 0, wait: 0 },
  Mat: { ok: 0, wip: 0, none: 0, wait: 0 },
  CNC: { ok: 0, wip: 0, none: 0, wait: 0 },
  Milling: { ok: 0, wip: 0, none: 0, wait: 0 },
  Assembly: { ok: 0, wip: 0, none: 0, wait: 0 },
});

/**
 * Computes per-department status counts, delivery completion counts, and
 * the lists of incomplete/urgent jobs (urgent = due within `urgentDaysConfig`
 * days, or with an unparseable due date).
 */
export function computeProductionSummary(
  data: JobData[],
  urgentDaysConfig: number,
): ProductionSummary {
  let totalOrderedQty = 0;
  let totalDeliveredQty = 0;
  const deptStats = EMPTY_DEPT_STATS();
  let deliveryFullyOk = 0;
  let deliveryPartial = 0;
  let deliveryWaiting = 0;

  const incompleteDeliveries: JobData[] = [];
  const urgentJobs: JobData[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const checkDept = (val: string, key: DeptKey) => {
    if (val === "OK") deptStats[key].ok++;
    else if (val === "In Progress") deptStats[key].wip++;
    else if (val === "None") deptStats[key].none++;
    else deptStats[key].wait++;
  };

  data.forEach((job) => {
    const qTarget = parseInt(job.Qty) || 0;
    const qDelivered = job.delivered_qty_total || 0;
    totalOrderedQty += qTarget;
    totalDeliveredQty += qDelivered;

    if (qDelivered >= qTarget && qTarget > 0) deliveryFullyOk++;
    else if (qDelivered > 0) deliveryPartial++;
    else deliveryWaiting++;

    if (qDelivered < qTarget) {
      incompleteDeliveries.push(job);
      const dueDateObj = parseThaiDateToObj(job.Due_Date);
      if (dueDateObj) {
        const daysDiff = Math.ceil(
          (dueDateObj.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
        );
        if (daysDiff <= urgentDaysConfig) urgentJobs.push(job);
      } else {
        urgentJobs.push(job);
      }
    }

    checkDept(job.Status_Drawing || "Waiting", "Drawing");
    checkDept(job.Status_Mat || "Waiting", "Mat");
    checkDept(job.Status_CNC || "Waiting", "CNC");
    checkDept(job.Status_Milling || "Waiting", "Milling");
    checkDept(job.Status_Assembly || "Waiting", "Assembly");
  });

  return {
    totalJobs: data.length,
    totalOrderedQty,
    totalDeliveredQty,
    deptStats,
    deliveryFullyOk,
    deliveryPartial,
    deliveryWaiting,
    incompleteDeliveries,
    urgentJobs,
  };
}

export interface MonthlyRevenueItem {
  label: string;
  value: number;
}

export interface FinancialSummary {
  totalFinancialValue: number;
  totalDeliveredValue: number;
  totalPendingValue: number;
  monthlyRevenueList: MonthlyRevenueItem[];
  maxMonthlyValue: number;
}

/**
 * Computes PO-value totals and a monthly revenue breakdown, filtered to
 * jobs whose PO_Date falls within [financialStartDate, financialEndDate]
 * (both Thai "DD/MM/YYYY" strings; either may be empty to leave that
 * bound open).
 */
export function computeFinancialSummary(
  data: JobData[],
  financialStartDate: string,
  financialEndDate: string,
): FinancialSummary {
  let totalFinancialValue = 0;
  let totalDeliveredValue = 0;
  let totalPendingValue = 0;
  const monthlyRevenueMap: Record<string, number> = {};

  const fStart = financialStartDate ? parseThaiDateToObj(financialStartDate) : null;
  const fEnd = financialEndDate ? parseThaiDateToObj(financialEndDate) : null;
  if (fStart) fStart.setHours(0, 0, 0, 0);
  if (fEnd) fEnd.setHours(23, 59, 59, 999);

  data.forEach((job) => {
    if (fStart || fEnd) {
      const poDateObj = parseThaiDateToObj(job.PO_Date || "");
      if (!poDateObj) return;
      if (fStart && poDateObj < fStart) return;
      if (fEnd && poDateObj > fEnd) return;
    }

    const qTarget = parseInt(job.Qty) || 0;
    const qDelivered = job.delivered_qty_total || 0;
    const unitPrice = parseFloat(job.Price?.replace(/,/g, "") || "0") || 0;

    const jobTotalValue = qTarget * unitPrice;
    const jobDeliveredValue = qDelivered * unitPrice;
    const jobPendingValue = Math.max(0, qTarget - qDelivered) * unitPrice;

    totalFinancialValue += jobTotalValue;
    totalDeliveredValue += jobDeliveredValue;
    totalPendingValue += jobPendingValue;

    if (job.PO_Date && jobTotalValue > 0) {
      const dateParts = job.PO_Date.split("/");
      if (dateParts.length === 3) {
        const monthIdx = parseInt(dateParts[1]) - 1;
        const yearThai = dateParts[2];
        if (monthIdx >= 0 && monthIdx < 12) {
          const monthYearLabel = `${THAI_MONTHS[monthIdx]} ${yearThai}`;
          monthlyRevenueMap[monthYearLabel] =
            (monthlyRevenueMap[monthYearLabel] || 0) + jobTotalValue;
        }
      }
    }
  });

  const monthlyRevenueList = Object.entries(monthlyRevenueMap).map(
    ([label, value]) => ({ label, value }),
  );
  const maxMonthlyValue = Math.max(
    ...monthlyRevenueList.map((item) => item.value),
    1,
  );

  return {
    totalFinancialValue,
    totalDeliveredValue,
    totalPendingValue,
    monthlyRevenueList,
    maxMonthlyValue,
  };
}

/**
 * Filters the production table by free-text search, customer, and
 * delivery status, then orders the result newest-first (jobs are
 * appended to the end of the sheet on creation, so reversing puts the
 * most recently added job on top).
 */
export function filterProductionData(
  data: JobData[],
  searchTerm: string,
  customerFilterInput: string,
  deliveryStatusFilter: DeliveryFilterType,
): JobData[] {
  return data.filter((job) => {
    const matchesSearch =
      job.Job_ID.toLowerCase().includes(searchTerm.toLowerCase()) ||
      job.Job_Description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (job.PO && job.PO.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (job.Quotation && job.Quotation.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesCustomer =
      customerFilterInput === "" ||
      job.Customer.toLowerCase().includes(customerFilterInput.toLowerCase());

    const targetQty = parseInt(job.Qty) || 0;
    const deliveredQty = job.delivered_qty_total || 0;
    let matchesDeliveryStatus = true;

    if (deliveryStatusFilter === "completed")
      matchesDeliveryStatus = deliveredQty >= targetQty && targetQty > 0;
    else if (deliveryStatusFilter === "partial")
      matchesDeliveryStatus = deliveredQty > 0 && deliveredQty < targetQty;
    else if (deliveryStatusFilter === "pending")
      matchesDeliveryStatus = deliveredQty === 0;

    return matchesSearch && matchesCustomer && matchesDeliveryStatus;
  }).reverse();
}

/** Jobs that still have outstanding quantity to deliver, filtered by search text. */
export function filterPendingDeliveryJobs(
  data: JobData[],
  deliveryJobSearch: string,
): JobData[] {
  return data.filter(
    (j) =>
      (parseInt(j.Qty) || 0) > (j.delivered_qty_total || 0) &&
      (j.Job_ID.toLowerCase().includes(deliveryJobSearch.toLowerCase()) ||
        j.Customer.toLowerCase().includes(deliveryJobSearch.toLowerCase()) ||
        j.Job_Description.toLowerCase().includes(deliveryJobSearch.toLowerCase())),
  );
}

export function getUniqueCustomers(data: JobData[]): string[] {
  return Array.from(new Set(data.map((j) => j.Customer).filter(Boolean)));
}

