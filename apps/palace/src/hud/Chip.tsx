"use client";
import type { ReactNode } from "react";

export type ChipTone = "neutral" | "gold" | "red" | "blue" | "violet";

const TONES: Record<ChipTone, string> = {
  neutral: "bg-zinc-100 text-zinc-700 ring-zinc-200",
  gold: "bg-amber-100 text-amber-900 ring-amber-300",
  red: "bg-red-50 text-red-800 ring-red-200",
  blue: "bg-sky-50 text-sky-900 ring-sky-200",
  violet: "bg-violet-50 text-violet-900 ring-violet-200",
};

export interface ChipProps {
  children: ReactNode;
  tone?: ChipTone;
  title?: string;
}

export function Chip({ children, tone = "neutral", title }: ChipProps) {
  return (
    <span title={title} className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium leading-4 ring-1 ring-inset ${TONES[tone]}`}>
      {children}
    </span>
  );
}
