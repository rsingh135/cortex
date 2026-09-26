"use client";
/** One line under a floor plan: what the dot and the red badge mean. */

export interface MinimapLegendProps {
  /** Whether a you-are-here dot is drawn on the map this legend sits under. */
  showPlayer?: boolean;
  className?: string;
}

export function MinimapLegend({ showPlayer = true, className = "" }: MinimapLegendProps) {
  return (
    <ul className={`flex flex-wrap items-center gap-x-3 gap-y-1 text-xs leading-4 text-zinc-600 ${className}`} aria-label="Map legend">
      {showPlayer && (
        <li className="flex items-center gap-1.5">
          <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-full bg-sky-600 ring-2 ring-white" />
          you
        </li>
      )}
      <li className="flex items-center gap-1.5">
        <span aria-hidden className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-red-600 text-[9px] font-bold leading-none text-white">
          !
        </span>
        cracked procedure
      </li>
    </ul>
  );
}
