"use client";

import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { JobData, DeliveryLogItem, SheetsGetResponse } from "@/app/types";
import { getUniqueCustomers } from "@/lib/dashboard-calculations";
import { useToast } from "@/components/toast/ToastProvider";

/**
 * Fetches job/delivery data from the `/sheets` API route and exposes it
 * along with a derived, editable customer list: names saved in the
 * Customers sheet, plus customers appearing on existing jobs, plus any
 * added via `addCustomer` (which also persists the name to the Customers
 * sheet through the ADD_CUSTOMER action).
 */
export function useJobsData() {
  const { showToast } = useToast();
  const [data, setData] = useState<JobData[]>([]);
  const [deliveryLogs, setDeliveryLogs] = useState<DeliveryLogItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [urgentDaysConfig, setUrgentDaysConfig] = useState<number>(5);
  const [customCustomerList, setCustomCustomerList] = useState<string[]>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get<SheetsGetResponse>("/sheets");

      if (res.data.success) {
        setData(res.data.data);
        setDeliveryLogs(res.data.deliveryLogs || []);
        if (res.data.urgentDays) setUrgentDaysConfig(res.data.urgentDays);
        // Saved customers (Customers sheet) first, then customers derived
        // from existing jobs, de-duplicated case-insensitively.
        const saved = res.data.customers || [];
        const derived = getUniqueCustomers(res.data.data);
        const seen = new Set<string>();
        const merged: string[] = [];
        for (const name of [...saved, ...derived]) {
          const key = name.trim().toLowerCase();
          if (!key || seen.has(key)) continue;
          seen.add(key);
          merged.push(name.trim());
        }
        setCustomCustomerList(merged);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      showToast("ดึงข้อมูลล้มเหลว: " + message, "error");
    }
    setLoading(false);
  }, [showToast]);

  useEffect(() => {
    // Intentional fetch-on-mount: this hook's whole job is to load the
    // sheet data once the dashboard mounts, so this rule's usual concern
    // (an effect masking derived state) doesn't apply here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData();
  }, [fetchData]);

  const addCustomer = useCallback(
    async (name: string) => {
      // Optimistic: the name is usable in the form immediately; persisting
      // to the Customers sheet happens in the background so a slow network
      // doesn't block job entry. Failures are surfaced as a toast - the
      // name stays usable locally and can be re-added later.
      setCustomCustomerList((prev) => [name, ...prev]);
      try {
        await axios.post("/sheets", { action: "ADD_CUSTOMER", name });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        showToast(`บันทึกชื่อลูกค้าลง Google Sheet ไม่สำเร็จ: ${message}`, "error");
      }
    },
    [showToast],
  );

  return {
    data,
    setData,
    deliveryLogs,
    loading,
    setLoading,
    urgentDaysConfig,
    customCustomerList,
    addCustomer,
    fetchData,
  };
}
