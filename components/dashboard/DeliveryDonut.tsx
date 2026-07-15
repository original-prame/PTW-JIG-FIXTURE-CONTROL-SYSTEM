"use client";

interface DeliveryDonutProps {
  deliveryFullyOk: number;
  deliveryPartial: number;
  deliveryWaiting: number;
}

export function DeliveryDonut({ deliveryFullyOk, deliveryPartial, deliveryWaiting }: DeliveryDonutProps) {
  const totalDelivStatusCount = deliveryFullyOk + deliveryPartial + deliveryWaiting;
  const fullyOkPercent =
    totalDelivStatusCount > 0 ? Math.round((deliveryFullyOk / totalDelivStatusCount) * 100) : 0;
  const partialPercent =
    totalDelivStatusCount > 0 ? Math.round((deliveryPartial / totalDelivStatusCount) * 100) : 0;

  return (
    <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow duration-200 text-center">
      <h3 className="text-sm font-bold text-slate-700 uppercase border-b pb-2 mb-4 text-left">
        📈 สัดส่วนการปิดใบสั่งจัดส่งสินค้า
      </h3>
      <div
        className="inline-block relative w-32 h-32 rounded-full border-4 border-slate-100 shadow bg-red-100 mt-2"
        style={{
          background: `conic-gradient(#22c55e 0% ${fullyOkPercent}%, #f59e0b ${fullyOkPercent}%, #f59e0b ${fullyOkPercent + partialPercent}%, #ef4444 ${fullyOkPercent + partialPercent}% 100%)`,
        }}
      >
        <div className="absolute inset-4 bg-white rounded-full flex flex-col justify-center items-center">
          <span className="text-2xl font-black text-slate-800">{fullyOkPercent}%</span>
          <span className="text-[9px] font-bold text-slate-400 uppercase">ส่งครบถ้วน</span>
        </div>
      </div>
    </div>
  );
}
