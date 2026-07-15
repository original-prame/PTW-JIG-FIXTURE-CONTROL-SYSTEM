"use client";

interface SubmitButtonProps {
  onClick: () => void;
  label: string;
  isSaving?: boolean;
  savingLabel?: string;
  className?: string;
}

/**
 * Primary gradient action button with a built-in "saving..." state
 * (spinner + disabled) so every form in the app shows the same visual
 * feedback while a request is in flight, on top of the toast notice.
 */
export function SubmitButton({
  onClick,
  label,
  isSaving = false,
  savingLabel = "กำลังบันทึก...",
  className,
}: SubmitButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isSaving}
      className={
        className ||
        "w-full flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer text-white p-3 rounded-lg font-bold transition text-sm shadow-md shadow-indigo-500/20"
      }
    >
      {isSaving && (
        <span className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin shrink-0" />
      )}
      {isSaving ? savingLabel : label}
    </button>
  );
}
