"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { ToastViewport } from "./ToastViewport";

export type ToastVariant = "success" | "error" | "warning" | "info" | "loading";

export interface ToastItem {
  id: string;
  message: string;
  variant: ToastVariant;
}

interface ToastPatch {
  message?: string;
  variant?: ToastVariant;
  /** Milliseconds until auto-dismiss. Pass Infinity (or omit for "loading") to keep it open. */
  timeoutMs?: number;
}

interface ToastContextValue {
  showToast: (message: string, variant?: ToastVariant, timeoutMs?: number) => string;
  updateToast: (id: string, patch: ToastPatch) => void;
  dismissToast: (id: string) => void;
}

const DEFAULT_TIMEOUT_MS: Record<ToastVariant, number | undefined> = {
  success: 3500,
  error: 5000,
  warning: 4200,
  info: 3500,
  // "loading" toasts stay open until explicitly updated/dismissed by the caller.
  loading: undefined,
};

const ToastContext = createContext<ToastContextValue | null>(null);

/**
 * Material-Tailwind-style toast/alert stack. Mount once near the root of
 * the app (see app/page.tsx) and call `useToast()` anywhere below it
 * instead of the browser's `alert()`.
 *
 * The `loading` variant is what powers the "กำลังบันทึกข้อมูล..." (saving)
 * notice: show a loading toast when a request starts, then call
 * `updateToast` with a `success`/`error` variant once it resolves - the
 * same toast morphs in place and picks up that variant's auto-dismiss
 * timeout.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const clearTimer = (id: string) => {
    const timer = timers.current[id];
    if (timer) {
      clearTimeout(timer);
      delete timers.current[id];
    }
  };

  const dismissToast = useCallback((id: string) => {
    clearTimer(id);
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const scheduleTimeout = useCallback(
    (id: string, timeoutMs: number | undefined) => {
      clearTimer(id);
      if (timeoutMs !== undefined && Number.isFinite(timeoutMs)) {
        timers.current[id] = setTimeout(() => dismissToast(id), timeoutMs);
      }
    },
    [dismissToast],
  );

  const showToast = useCallback(
    (message: string, variant: ToastVariant = "info", timeoutMs?: number) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      setToasts((prev) => [...prev, { id, message, variant }]);
      scheduleTimeout(id, timeoutMs ?? DEFAULT_TIMEOUT_MS[variant]);
      return id;
    },
    [scheduleTimeout],
  );

  const updateToast = useCallback(
    (id: string, patch: ToastPatch) => {
      setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
      const nextTimeout = patch.timeoutMs ?? (patch.variant ? DEFAULT_TIMEOUT_MS[patch.variant] : undefined);
      scheduleTimeout(id, nextTimeout);
    },
    [scheduleTimeout],
  );

  return (
    <ToastContext.Provider value={{ showToast, updateToast, dismissToast }}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismissToast} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within a <ToastProvider>");
  return ctx;
}
