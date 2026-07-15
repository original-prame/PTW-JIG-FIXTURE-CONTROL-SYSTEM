"use client";

import { useEffect, RefObject } from "react";

/**
 * Calls `onOutsideClick` when a mousedown happens outside of `ref`'s
 * element. Used to close dropdowns / date-picker popovers.
 *
 * The original component wired this same logic by hand for every single
 * dropdown and calendar popover (10 near-identical `if` blocks inside one
 * big `useEffect`). Centralizing it here lets each component that owns a
 * popover manage its own open/close state instead of the page component
 * having to know about every popover in the app.
 */
export function useOutsideClick<T extends HTMLElement>(
  ref: RefObject<T | null>,
  onOutsideClick: () => void,
) {
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        onOutsideClick();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref]);
}
