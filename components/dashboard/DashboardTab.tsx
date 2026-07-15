"use client";

import { JobData } from "@/app/types";
import { computeProductionSummary, computeFinancialSummary } from "@/lib/dashboard-calculations";
import { KpiCards } from "./KpiCards";
import { DepartmentBottleneck } from "./DepartmentBottleneck";
import { DeliveryDonut } from "./DeliveryDonut";
import { FinancialOverview } from "./FinancialOverview";
import { UrgentJobsPanel } from "./UrgentJobsPanel";
import { IncompleteDeliveriesTable } from "./IncompleteDeliveriesTable";

interface DashboardTabProps {
  data: JobData[];
  urgentDaysConfig: number;
  financialStartDate: string;
  financialEndDate: string;
  onFinancialStartChange: (v: string) => void;
  onFinancialEndChange: (v: string) => void;
  onFinancialClear: () => void;
}

export function DashboardTab({
  data,
  urgentDaysConfig,
  financialStartDate,
  financialEndDate,
  onFinancialStartChange,
  onFinancialEndChange,
  onFinancialClear,
}: DashboardTabProps) {
  const summary = computeProductionSummary(data, urgentDaysConfig);
  const financialSummary = computeFinancialSummary(data, financialStartDate, financialEndDate);

  return (
    <div className="space-y-6">
      <KpiCards
        totalJobs={summary.totalJobs}
        totalOrderedQty={summary.totalOrderedQty}
        totalDeliveredQty={summary.totalDeliveredQty}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <DepartmentBottleneck deptStats={summary.deptStats} />
        <DeliveryDonut
          deliveryFullyOk={summary.deliveryFullyOk}
          deliveryPartial={summary.deliveryPartial}
          deliveryWaiting={summary.deliveryWaiting}
        />
      </div>

      <FinancialOverview
        financialStartDate={financialStartDate}
        financialEndDate={financialEndDate}
        onStartChange={onFinancialStartChange}
        onEndChange={onFinancialEndChange}
        onClear={onFinancialClear}
        summary={financialSummary}
      />

      <UrgentJobsPanel urgentJobs={summary.urgentJobs} urgentDaysConfig={urgentDaysConfig} />

      <IncompleteDeliveriesTable incompleteDeliveries={summary.incompleteDeliveries} />
    </div>
  );
}
