"use client";

import type { ToastItem, ToastVariant } from "./ToastProvider";

const VARIANT_STYLES: Record<
  ToastVariant,
  { wrapper: string; iconWrapper: string; text: string; icon: React.ReactNode }
> = {
  success: {
    wrapper: "border-emerald-500 bg-emerald-50/95",
    iconWrapper: "bg-emerald-100 text-emerald-600",
    text: "text-emerald-900",
    icon: <span>✓</span>,
  },
  error: {
    wrapper: "border-red-500 bg-red-50/95",
    iconWrapper: "bg-red-100 text-red-600",
    text: "text-red-900",
    icon: <span>✕</span>,
  },
  warning: {
    wrapper: "border-amber-500 bg-amber-50/95",
    iconWrapper: "bg-amber-100 text-amber-600",
    text: "text-amber-900",
    icon: <span>⚠</span>,
  },
  info: {
    wrapper: "border-indigo-500 bg-indigo-50/95",
    iconWrapper: "bg-indigo-100 text-indigo-600",
    text: "text-indigo-900",
    icon: <span>ℹ</span>,
  },
  loading: {
    wrapper: "border-indigo-500 bg-indigo-50/95",
    iconWrapper: "bg-indigo-100 text-indigo-600",
    text: "text-indigo-900",
    icon: <span className="block w-3 h-3 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin" />,
  },
};

interface ToastViewportProps {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}

export function ToastViewport({ toasts, onDismiss }: ToastViewportProps) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 left-4 right-4 sm:left-auto z-[100] flex flex-col gap-2 w-auto sm:w-full sm:max-w-sm pointer-events-none">
      {toasts.map((toast) => {
        const style = VARIANT_STYLES[toast.variant];
        return (
          <div
            key={toast.id}
            className={`toast-enter pointer-events-auto flex items-start gap-3 rounded-2xl border-l-4 p-3.5 shadow-lg backdrop-blur-sm ${style.wrapper}`}
          >
            <span
              className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${style.iconWrapper}`}
            >
              {style.icon}
            </span>
            <p className={`flex-1 text-sm font-semibold leading-snug pt-0.5 ${style.text}`}>{toast.message}</p>
            {toast.variant !== "loading" && (
              <button
                type="button"
                onClick={() => onDismiss(toast.id)}
                className={`shrink-0 text-xs font-bold opacity-50 hover:opacity-100 transition cursor-pointer ${style.text}`}
                aria-label="ปิดการแจ้งเตือน"
              >
                ✕
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
