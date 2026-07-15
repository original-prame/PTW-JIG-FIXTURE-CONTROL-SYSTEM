"use client";

import { useEffect, useState } from "react";

/**
 * Client-side pagination over an already-computed array. Also clamps the
 * current page back into range when the underlying list shrinks (e.g.
 * after a delivery completes and a job drops out of an "incomplete"
 * list) and the current page no longer exists.
 */
export function usePagination<T>(items: T[], itemsPerPage: number) {
  const [currentPage, setCurrentPage] = useState(1);
  const totalItems = items.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);

  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCurrentPage(1);
    }
  }, [totalItems, totalPages, currentPage]);

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = items.slice(indexOfFirstItem, indexOfLastItem);

  return { currentItems, currentPage, setCurrentPage, totalItems, totalPages };
}
