"use client";

import { useRef, useState } from "react";
import { useOutsideClick } from "@/hooks/useOutsideClick";

interface CustomerComboboxProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
  /** Shows a "show all / clear" item at the top of the list (used by the production-table filter). */
  showResetAll?: boolean;
  /** Message shown when the filtered list is empty. If omitted, nothing is rendered for the empty case. */
  emptyMessage?: string;
  /**
   * Selection-only mode: typing just filters the list, and the value can
   * ONLY become one of `options` (by clicking it). Free text is never
   * committed - closing the dropdown discards whatever was typed. Used by
   * the add-job and edit-job forms so a customer must be created (and saved
   * to the Customers sheet) before it can be put on a job; the filter on
   * the production table stays free-text.
   */
  strictSelect?: boolean;
  triggerClassName?: string;
  wrapperClassName?: string;
  labelClassName?: string;
}

/**
 * A searchable, single-select customer dropdown: typing filters the list,
 * and clicking an option selects it. Backs the customer filter on the
 * production table, the customer field on the add-job form, and the
 * customer field on the edit-job modal - three call sites that previously
 * each hand-rolled their own copy of this same dropdown/outside-click logic.
 */
export function CustomerCombobox({
  label,
  value,
  onChange,
  options,
  placeholder,
  showResetAll = false,
  emptyMessage,
  strictSelect = false,
  triggerClassName,
  wrapperClassName,
  labelClassName,
}: CustomerComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  // Strict mode keeps the typed search separate from the committed value.
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  useOutsideClick(ref, () => {
    setIsOpen(false);
    if (strictSelect) setSearch("");
  });

  const filterText = strictSelect ? search : value;
  const filteredOptions = options.filter((cust) =>
    cust.toLowerCase().includes(filterText.toLowerCase()),
  );

  const inputValue = strictSelect ? (isOpen ? search : value) : value;
  const inputPlaceholder = strictSelect && isOpen && value ? value : placeholder;

  return (
    <div className={`relative ${wrapperClassName || ""}`} ref={ref}>
      <label className={labelClassName || "block text-xs font-bold text-slate-500 uppercase mb-1"}>{label}</label>
      <div
        onClick={() => setIsOpen(true)}
        className={
          triggerClassName ||
          "w-full p-2.5 border border-slate-300 rounded-lg bg-slate-50 flex justify-between items-center cursor-pointer text-sm"
        }
      >
        <input
          type="text"
          value={inputValue}
          onChange={(e) => {
            if (strictSelect) setSearch(e.target.value);
            else onChange(e.target.value);
            setIsOpen(true);
          }}
          placeholder={inputPlaceholder}
          className="w-full bg-transparent outline-none text-sm"
        />
        <span className="text-slate-400 text-xs">▼</span>
      </div>
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl max-h-56 overflow-y-auto">
          {showResetAll && (
            <div
              onClick={() => {
                onChange("");
                setIsOpen(false);
              }}
              className="p-2.5 px-4 text-sm text-indigo-600 hover:bg-slate-100 cursor-pointer font-bold border-b"
            >
              แสดงลูกค้าทั้งหมด
            </div>
          )}
          {filteredOptions.length === 0 && emptyMessage ? (
            <div className="p-2.5 px-4 text-xs text-slate-400 text-center">{emptyMessage}</div>
          ) : (
            filteredOptions.map((cust) => (
              <div
                key={cust}
                onClick={() => {
                  onChange(cust);
                  setSearch("");
                  setIsOpen(false);
                }}
                className="p-2.5 px-4 text-sm hover:bg-indigo-500 hover:text-white cursor-pointer font-medium"
              >
                🏢 {cust}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
