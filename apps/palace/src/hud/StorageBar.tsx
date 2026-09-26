"use client";
/** One meter row: label, bytes, same-ramp track. */
import { formatBytes } from "@/lib/format";

export interface StorageBarProps {
  label: string;
  /** True value, for assistive text. */
  bytes: number;
  /** Value to print; may lag `bytes` while a counter tweens. */
  shownBytes?: number;
  fraction: number;
  fill: string;
  track: string;
  percent: string;
}

export function StorageBar({ label, bytes, shownBytes = bytes, fraction, fill, track, percent }: StorageBarProps) {
  return (
    <div className="mt-2 first:mt-0">
      <div className="flex justify-between text-xs leading-4 text-zinc-600">
        <span>{label}</span>
        <span className="font-medium tabular-nums text-zinc-900" aria-hidden>
          {formatBytes(shownBytes)}
        </span>
      </div>
      <div className={`mt-1 h-2 w-full overflow-hidden rounded-full ${track}`} role="meter" aria-label={`${label} bytes`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(fraction * 100)} aria-valuetext={`${formatBytes(bytes)}, ${percent} of keep-everything`}>
        <div className={`h-full rounded-full ${fill} transition-[width] duration-700 ease-spring-soft`} style={{ width: `${Math.max(fraction > 0 ? 2 : 0, fraction * 100)}%` }} />
      </div>
    </div>
  );
}
