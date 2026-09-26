"use client";
/**
 * One evidence screenshot at its current clarity: CSS blur ∝ (1 − clarity); empty frame when
 * forgotten. Fixture screens are drawn lazily, so the tile stays blank plaster until the data URL lands.
 */
import { useScreenUrl } from "@/lib/fixtures/screenUrl";
import { formatClarity, formatLevel, truncate } from "@/lib/format";
import { usePalaceActions } from "@/lib/store";
import type { PalaceCapture } from "@/lib/types";

const MAX_BLUR_PX = 8;

export interface EvidenceThumbProps {
  capture: PalaceCapture;
}

export function EvidenceThumb({ capture }: EvidenceThumbProps) {
  const { hover } = usePalaceActions();
  const src = useScreenUrl(capture.textureUrl);
  const forgotten = capture.ceiling === null || capture.textureUrl === null;
  const blur = Math.round((1 - Math.min(1, Math.max(0, capture.clarity))) * MAX_BLUR_PX * 10) / 10;
  const description = forgotten ? `${capture.title}, forgotten` : `${capture.title}, ${formatLevel(capture.ceiling)} at ${formatClarity(capture.clarity)} clarity`;
  return (
    <figure className="lift min-w-0 rounded-md" onMouseEnter={() => hover(capture.id)} onMouseLeave={() => hover(null)} onFocus={() => hover(capture.id)} onBlur={() => hover(null)} tabIndex={0}>
      <div className={`relative aspect-[16/10] overflow-hidden rounded-lg ring-1 ring-inset ${forgotten ? "border border-dashed border-zinc-300 bg-zinc-50 ring-transparent" : "bg-zinc-100 ring-zinc-200"}`}>
        {forgotten ? (
          <span className="absolute inset-0 flex items-center justify-center text-xs font-medium uppercase tracking-wide text-zinc-400">forgotten</span>
        ) : (
          <div
            role="img"
            aria-label={description}
            aria-busy={src === null}
            className="absolute -inset-1 bg-cover bg-center"
            style={{ backgroundImage: src ? `url("${src}")` : undefined, filter: blur > 0 ? `blur(${blur}px)` : undefined }}
          />
        )}
        <span className={`absolute bottom-1 right-1 rounded px-1 text-xs font-semibold leading-4 ${forgotten ? "bg-zinc-200 text-zinc-600" : "bg-white/90 text-zinc-800"}`}>{formatLevel(capture.ceiling)}</span>
      </div>
      <figcaption className="mt-1 truncate text-xs leading-4 text-zinc-600" title={capture.title}>
        {truncate(capture.title, 28)}
      </figcaption>
    </figure>
  );
}
