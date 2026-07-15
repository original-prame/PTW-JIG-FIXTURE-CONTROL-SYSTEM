"use client";

interface KpiCardsProps {
  totalJobs: number;
  totalOrderedQty: number;
  totalDeliveredQty: number;
}

interface KpiCardConfig {
  icon: string;
  label: string;
  value: number;
  unit: string;
  valueClassName: string;
  badgeClassName: string;
}

export function KpiCards({ totalJobs, totalOrderedQty, totalDeliveredQty }: KpiCardsProps) {
  const cards: KpiCardConfig[] = [
    {
      icon: "📁",
      label: "ใบสั่งผลิตทั้งหมด",
      value: totalJobs,
      unit: "รายการ",
      valueClassName: "text-slate-900",
      badgeClassName: "bg-slate-100 text-slate-600",
    },
    {
      icon: "📦",
      label: "จำนวนยอดสั่งซื้อรวม",
      value: totalOrderedQty,
      unit: "ชิ้นงาน",
      valueClassName: "text-indigo-600",
      badgeClassName: "bg-indigo-100 text-indigo-600",
    },
    {
      icon: "🚛",
      label: "ยอดจัดส่งสะสมสำเร็จ",
      value: totalDeliveredQty,
      unit: "ชิ้นงาน",
      valueClassName: "text-emerald-600",
      badgeClassName: "bg-emerald-100 text-emerald-600",
    },
    {
      icon: "⏳",
      label: "ชิ้นงานค้างส่งในระบบ",
      value: totalOrderedQty - totalDeliveredQty,
      unit: "ชิ้นงาน",
      valueClassName: "text-amber-600",
      badgeClassName: "bg-amber-100 text-amber-600",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => (
        <div
          key={card.label}
          className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex items-start justify-between gap-3 hover:shadow-md transition-shadow duration-200"
        >
          <div className="flex flex-col justify-between h-full">
            <span className="text-xs font-bold text-slate-400 uppercase">{card.label}</span>
            <span className={`text-2xl font-black mt-2 ${card.valueClassName}`}>
              {card.value} <span className="text-xs font-normal text-slate-500">{card.unit}</span>
            </span>
          </div>
          <span className={`shrink-0 w-9 h-9 rounded-xl flex items-center justify-center text-base ${card.badgeClassName}`}>
            {card.icon}
          </span>
        </div>
      ))}
    </div>
  );
}
