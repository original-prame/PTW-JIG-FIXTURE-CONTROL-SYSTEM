"use client";

import { DeptStats, DeptKey } from "@/lib/dashboard-calculations";

interface DepartmentBottleneckProps {
  deptStats: DeptStats;
}

const DEPT_ORDER: DeptKey[] = ["Drawing", "Mat", "CNC", "Milling", "Assembly"];

export function DepartmentBottleneck({ deptStats }: DepartmentBottleneckProps) {
  return (
    <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow duration-200 lg:col-span-2">
      <h3 className="text-sm font-bold text-slate-700 uppercase border-b pb-2 mb-4">
        📊 จำนวนชิ้นงานสะสมแยกตามแผนกปฏิบัติงาน
      </h3>
      <div className="space-y-4">
        {DEPT_ORDER.map((key) => {
          const stats = deptStats[key];
          const total = stats.ok + stats.wip + stats.none + stats.wait;
          return (
            <div key={key} className="grid grid-cols-4 items-center gap-2 text-xs">
              <span className="font-bold text-slate-600 text-right pr-2">
                {key === "Mat" ? "Mat'l (วัสดุ)" : key}
              </span>
              <div className="col-span-3 w-full bg-slate-100 h-6 rounded-md overflow-hidden flex shadow-inner">
                {stats.ok > 0 && (
                  <div
                    style={{ width: `${(stats.ok / total) * 100}%` }}
                    className="bg-green-500 text-white flex items-center justify-center font-bold text-[10px] cursor-default"
                    title={`OK: งานเสร็จสมบูรณ์แล้ว (${stats.ok} ชิ้น)`}
                  >
                    OK ({stats.ok})
                  </div>
                )}
                {stats.wip > 0 && (
                  <div
                    style={{ width: `${(stats.wip / total) * 100}%` }}
                    className="bg-yellow-500 text-yellow-900 flex items-center justify-center font-bold text-[10px] cursor-default"
                    title={`WIP: กำลังดำเนินการอยู่ (${stats.wip} ชิ้น)`}
                  >
                    WIP ({stats.wip})
                  </div>
                )}
                {stats.none > 0 && (
                  <div
                    style={{ width: `${(stats.none / total) * 100}%` }}
                    className="bg-slate-300 text-slate-600 flex items-center justify-center font-bold text-[10px] cursor-default"
                    title={`NONE: ไม่มีข้อมูล / ยังไม่ได้ระบุสถานะ (${stats.none} ชิ้น)`}
                  >
                    NONE ({stats.none})
                  </div>
                )}
                {stats.wait > 0 && (
                  <div
                    style={{ width: `${(stats.wait / total) * 100}%` }}
                    className="bg-red-400 text-white flex items-center justify-center font-bold text-[10px] cursor-default"
                    title={`WAIT: รอดำเนินการ ยังไม่เริ่มงาน (${stats.wait} ชิ้น)`}
                  >
                    WAIT ({stats.wait})
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
