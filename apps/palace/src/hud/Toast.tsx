"use client";
/** Short-lived notices as glass pills, top-centre; each springs in and the store auto-dismisses it. */
import { usePalaceStore, useToasts } from "@/lib/store";

export function Toasts() {
  const toasts = useToasts();
  const dismissToast = usePalaceStore((s) => s.dismissToast);
  if (toasts.length === 0) return null;
  return (
    <div className="pointer-events-none absolute left-1/2 top-4 z-20 flex -translate-x-1/2 flex-col items-center gap-2" role="status" aria-live="polite">
      {toasts.map((t) => (
        <button key={t.id} type="button" onClick={() => dismissToast(t.id)} className="glass-strong pointer-events-auto animate-card-enter rounded-full px-4 py-2 text-[13px] font-medium leading-5 text-zinc-800">
          {t.text}
        </button>
      ))}
    </div>
  );
}
