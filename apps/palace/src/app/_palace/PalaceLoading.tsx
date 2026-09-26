/** Shown while the palace bundle (three, R3F, drei) downloads. Same off-white as the sky horizon so the swap is quiet. */
export function PalaceLoading() {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-[#f6f5f2] text-sm text-zinc-500" role="status" aria-live="polite">
      Opening the palace…
    </div>
  );
}
