/** Pure formatting helpers for the HUD. No imports. */

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "0 B";
  if (bytes < 1_000) return `${Math.round(bytes)} B`;
  if (bytes < 1_000_000) return `${(bytes / 1_000).toFixed(bytes < 10_000 ? 1 : 0)} KB`;
  if (bytes < 1_000_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
  return `${(bytes / 1_000_000_000).toFixed(2)} GB`;
}

export function formatDay(day: number): string {
  return `Day ${Math.max(0, Math.round(day))}`;
}

/** 0..1 -> "37%". */
export function formatPercent(fraction: number, digits = 0): string {
  if (!Number.isFinite(fraction)) return "0%";
  return `${(Math.min(1, Math.max(0, fraction)) * 100).toFixed(digits)}%`;
}

/** Ratio of two byte counts as a percentage string, safe for a zero denominator. */
export function formatRatio(part: number, whole: number, digits = 0): string {
  return whole <= 0 ? "0%" : formatPercent(part / whole, digits);
}

export function formatConfidence(confidence: number): string {
  return Math.min(1, Math.max(0, confidence)).toFixed(2);
}

export function formatClarity(clarity: number): string {
  return formatPercent(clarity);
}

export function formatLevel(level: string | null): string {
  return level ?? "forgotten";
}

export function truncate(text: string, max = 80): string {
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

/** "3 recalls", "1 recall". */
export function formatCount(n: number, singular: string, plural = `${singular}s`): string {
  return `${n} ${n === 1 ? singular : plural}`;
}
