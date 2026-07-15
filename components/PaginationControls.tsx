"use client";

interface PaginationControlsProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

/**
 * Prev / numbered-pages-with-ellipsis / next control. Shared by
 * UrgentJobsPanel and IncompleteDeliveriesTable, which previously each
 * had their own copy of this same page-number-with-ellipsis logic.
 */
export function PaginationControls({ currentPage, totalPages, onPageChange }: PaginationControlsProps) {
  if (totalPages <= 1) return null;

  const pages: (number | string)[] = [];
  if (totalPages <= 5) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (currentPage > 3) pages.push("ellipsis-start");
    const startPage = Math.max(2, currentPage - 1);
    const endPage = Math.min(totalPages - 1, currentPage + 1);
    for (let i = startPage; i <= endPage; i++) {
      if (i !== 1 && i !== totalPages) pages.push(i);
    }
    if (currentPage < totalPages - 2) pages.push("ellipsis-end");
    pages.push(totalPages);
  }

  return (
    <div className="flex items-center justify-between border-t pt-4 mt-4 text-xs">
      <span className="text-slate-500">
        แสดงหน้า {currentPage} จากทั้งหมด {totalPages} หน้า
      </span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={currentPage === 1}
          onClick={() => onPageChange(Math.max(currentPage - 1, 1))}
          className={`px-3 py-1.5 rounded-lg font-bold transition ${
            currentPage === 1
              ? "bg-slate-100 text-slate-400 cursor-not-allowed"
              : "bg-white border text-slate-600 hover:bg-slate-50 cursor-pointer"
          }`}
        >
          ก่อนหน้า
        </button>

        {pages.map((page, idx) => {
          if (typeof page === "string") {
            return (
              <span key={`ellipsis-${idx}`} className="px-2 text-slate-400 font-bold select-none">
                ...
              </span>
            );
          }
          return (
            <button
              key={`page-${page}`}
              type="button"
              onClick={() => onPageChange(page)}
              className={`w-8 h-8 rounded-lg font-bold transition text-xs cursor-pointer ${
                currentPage === page
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "bg-white border text-slate-600 hover:bg-slate-50"
              }`}
            >
              {page}
            </button>
          );
        })}

        <button
          type="button"
          disabled={currentPage === totalPages}
          onClick={() => onPageChange(Math.min(currentPage + 1, totalPages))}
          className={`px-3 py-1.5 rounded-lg font-bold transition ${
            currentPage === totalPages
              ? "bg-slate-100 text-slate-400 cursor-not-allowed"
              : "bg-white border text-slate-600 hover:bg-slate-50 cursor-pointer"
          }`}
        >
          ถัดไป
        </button>
      </div>
    </div>
  );
}
