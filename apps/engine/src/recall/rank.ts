/** Ranking for recall results: relevance × confidence × clarity. docs/spec.md > The agent > Recall. */

export interface Rankable {
  id: string;
  /** 0..1 from exact match (1) or vector similarity. */
  relevance: number;
  confidence: number;
  /** Best clarity across the belief's alive evidence; 1 when the belief has no screenshots (it stands alone). */
  clarity: number;
}

export interface Ranked<T extends Rankable> {
  item: T;
  score: number;
}

export function score(r: Rankable): number {
  return clamp01(r.relevance) * clamp01(r.confidence) * clamp01(r.clarity);
}

export function rank<T extends Rankable>(items: readonly T[], limit = 10): Ranked<T>[] {
  return items
    .map((item) => ({ item, score: score(item) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score || a.item.id.localeCompare(b.item.id))
    .slice(0, limit);
}

function clamp01(x: number): number {
  return Math.min(1, Math.max(0, Number.isFinite(x) ? x : 0));
}
