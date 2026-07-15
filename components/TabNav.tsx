"use client";

import { TabType } from "@/app/types";

const TABS: { id: TabType; label: string }[] = [
  { id: "dashboard", label: "📊 สรุปรายงาน & วิเคราะห์กราฟ" },
  { id: "production_table", label: "🏭 อัปเดตสถานะการผลิต" },
  { id: "add_job", label: "➕ เปิดงานผลิตใหม่" },
  { id: "delivery", label: "📦 บันทึกส่งมอบงาน" },
  { id: "delivery_history", label: "📋 รายการส่งมอบงาน" },
];

interface TabNavProps {
  activeTab: TabType;
  onChange: (tab: TabType) => void;
}

export function TabNav({ activeTab, onChange }: TabNavProps) {
  return (
    <div className="flex border-b bg-white shadow-sm overflow-x-auto">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={`px-3.5 py-2.5 text-xs sm:px-6 sm:py-3 sm:text-sm transition whitespace-nowrap cursor-pointer ${
            activeTab === tab.id
              ? "border-b-2 border-indigo-500 font-bold text-indigo-600 bg-indigo-50/60 rounded-t-lg"
              : "text-gray-500 hover:text-gray-700 hover:bg-slate-50 rounded-t-lg"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
