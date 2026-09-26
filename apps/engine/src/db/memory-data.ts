import type {
  Belief,
  BeliefState,
  Capture,
  CaptureState,
  ImageLevel,
  Procedure,
  Edge,
  Recall,
  DailyStat,
  Episode,
  Decision,
} from "@cortex/schema";
export interface MemoryData {
  day: number;
  stats: DailyStat[];
  beliefs: Belief[];
  beliefStates: BeliefState[];
  captures: Capture[];
  captureStates: CaptureState[];
  levels: ImageLevel[];
  procedures: Procedure[];
  edges: Edge[];
  recalls: Recall[];
  episodes: Episode[];
  decisions: Decision[];
}
export const emptyMemory = (): MemoryData => ({
  day: 0,
  stats: [],
  beliefs: [],
  beliefStates: [],
  captures: [],
  captureStates: [],
  levels: [],
  procedures: [],
  edges: [],
  recalls: [],
  episodes: [],
  decisions: [],
});
export const withoutEmbedding = <T extends { embedding?: unknown }>(
  value: T,
): Omit<T, "embedding"> => {
  const { embedding: _, ...rest } = value;
  return rest;
};
