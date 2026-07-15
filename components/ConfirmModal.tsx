"use client";

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * A small "are you sure?" modal, used in place of the browser's native
 * `confirm()` dialog for destructive actions (deleting a job or a
 * delivery record) so the confirmation matches the rest of the app's UI.
 */
export function ConfirmModal({
  isOpen,
  title,
  message,
  confirmLabel = "ยืนยันลบ",
  cancelLabel = "ยกเลิก",
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-3 sm:p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl border w-full max-w-sm overflow-hidden">
        <div className="p-5 space-y-3">
          <h3 className="font-bold text-base text-slate-800 flex items-center gap-2">⚠️ {title}</h3>
          <p className="text-sm text-slate-600">{message}</p>
        </div>
        <div className="bg-slate-50 p-4 border-t flex gap-2 justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="bg-slate-300 hover:bg-slate-400 text-slate-700 font-bold px-4 py-2 rounded-lg text-xs transition cursor-pointer"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="bg-red-600 hover:bg-red-700 text-white font-bold px-5 py-2 rounded-lg text-xs transition shadow cursor-pointer"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
