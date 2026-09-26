"use client";
/** The selected painting: the screenshot at its current clarity, its app, level ceiling and the beliefs it supports. */
import { useScreenUrl } from "@/lib/fixtures/screenUrl";
import { formatClarity, formatCount, formatDay, formatLevel, truncate } from "@/lib/format";
import { usePalaceActions, useSnapshot } from "@/lib/store";
import type { PalaceCapture } from "@/lib/types";
import { Chip } from "./Chip";

const MAX_BLUR_PX = 8;

export interface CaptureCardProps {
  capture: PalaceCapture;
}

export function CaptureCard({ capture }: CaptureCardProps) {
  const snapshot = useSnapshot();
  const { select } = usePalaceActions();
  const src = useScreenUrl(capture.textureUrl);
  const forgotten = capture.ceiling === null || capture.textureUrl === null;
  const blur = Math.round((1 - Math.min(1, Math.max(0, capture.clarity))) * MAX_BLUR_PX * 10) / 10;
  const supports = snapshot.beliefs.filter((b) => b.status !== "tombstoned" && b.evidence.includes(capture.id));

  return (
    <section className="w-80 max-w-[calc(100vw-2rem)] rounded-xl bg-white/95 p-4 text-sm shadow-lg ring-1 ring-zinc-200 backdrop-blur" aria-labelledby="capture-card-title">
      <header className="flex items-start gap-2">
        <div className="flex flex-1 flex-wrap gap-1">
          <Chip tone="blue">screenshot</Chip>
          <Chip>{capture.app}</Chip>
          <Chip tone={forgotten ? "neutral" : "violet"} title="Highest resolution level still kept">
            {forgotten ? "forgotten" : formatLevel(capture.ceiling)}
          </Chip>
        </div>
        <button type="button" onClick={() => select(null)} aria-label="Close screenshot card" className="-mr-1 -mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 focus-visible:outline-2 focus-visible:outline-sky-600">
          <span aria-hidden className="text-base leading-none">
            ×
          </span>
        </button>
      </header>

      <h2 id="capture-card-title" className="mt-3 text-[15px] font-medium leading-6 text-zinc-900">
        {capture.title}
      </h2>

      <div className={`relative mt-3 aspect-[16/10] overflow-hidden rounded-md ring-1 ring-inset ${forgotten ? "border border-dashed border-zinc-300 bg-zinc-50 ring-transparent" : "bg-zinc-100 ring-zinc-200"}`}>
        {forgotten ? (
          <span className="absolute inset-0 flex items-center justify-center text-xs font-medium uppercase tracking-wide text-zinc-400">forgotten</span>
        ) : (
          <div role="img" aria-label={`${capture.title} at ${formatClarity(capture.clarity)} clarity`} aria-busy={src === null} className="absolute -inset-2 bg-cover bg-center" style={{ backgroundImage: src ? `url("${src}")` : undefined, filter: blur > 0 ? `blur(${blur}px)` : undefined }} />
        )}
      </div>

      <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
        <div>
          <dt className="text-zinc-500">Clarity</dt>
          <dd className="font-semibold tabular-nums text-zinc-900">{formatClarity(capture.clarity)}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">Captured</dt>
          <dd className="font-semibold text-zinc-900">{formatDay(capture.day)}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">Recalls</dt>
          <dd className="font-semibold tabular-nums text-zinc-900">
            {capture.recalls}
            {capture.lastRecallDay > 0 && <span className="font-normal text-zinc-500">, last {formatDay(capture.lastRecallDay).toLowerCase()}</span>}
          </dd>
        </div>
      </dl>

      <div className="mt-3">
        <div className="text-xs text-zinc-600">Evidence for {formatCount(supports.length, "belief")}</div>
        {supports.length > 0 && (
          <ul className="mt-1.5 space-y-1">
            {supports.slice(0, 5).map((b) => (
              <li key={b.id}>
                <button type="button" onClick={() => select(b.id)} className="w-full rounded-md px-2 py-1 text-left text-[13px] leading-5 text-zinc-800 ring-1 ring-inset ring-zinc-200 hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-sky-600">
                  {truncate(b.text, 80)}
                </button>
              </li>
            ))}
          </ul>
        )}
        {supports.length > 5 && <div className="mt-1 text-xs text-zinc-500">+{supports.length - 5} more</div>}
      </div>
    </section>
  );
}
