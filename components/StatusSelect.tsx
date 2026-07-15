"use client";

interface StatusSelectProps {
  value: string;
  onChange: (nextVal: string) => void;
}

/** The WAIT / WIP / NONE / OK dropdown used for each department column in the production table. */
export function StatusSelect({ value, onChange }: StatusSelectProps) {
  const currentStatus = value || "Waiting";
  const selectBgColor =
    currentStatus === "OK"
      ? "bg-green-50 text-green-700 border-green-200"
      : currentStatus === "In Progress"
        ? "bg-yellow-50 text-yellow-700 border-yellow-200"
        : currentStatus === "None"
          ? "bg-slate-100 text-slate-500 border-slate-300"
          : "bg-red-50 text-red-600 border-red-200";

  return (
    <select
      value={currentStatus}
      onChange={(e) => onChange(e.target.value)}
      className={`w-full p-1 border rounded-md font-bold text-[10px] outline-none cursor-pointer ${selectBgColor}`}
    >
      <option value="Waiting">🔴 WAIT</option>
      <option value="In Progress">🟡 WIP</option>
      <option value="None">⚪ NONE</option>
      <option value="OK">🟢 OK</option>
    </select>
  );
}
