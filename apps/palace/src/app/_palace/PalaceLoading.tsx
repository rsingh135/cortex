/** Shown while the palace bundle (three, R3F, drei) downloads. Same off-white as the sky horizon so the swap is quiet. */
export function PalaceLoading() {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-[#f6f5f2]" role="status" aria-live="polite">
      <div className="glass flex items-center gap-3 rounded-full py-2 pl-3 pr-4 text-[13px] font-medium text-zinc-700 animate-card-enter">
        <span className="relative h-2.5 w-2.5 overflow-hidden rounded-full bg-sky-600/20" aria-hidden>
          <span className="shimmer absolute inset-0" />
        </span>
        Opening the palace…
      </div>
    </div>
  );
}
