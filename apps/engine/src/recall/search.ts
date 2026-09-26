import { ulid } from "ulid";
import {
  RecallResponse,
  servedLevel,
  type RecallRequest,
  type Recall,
} from "@cortex/schema";
import { planRecall } from "../forgetting/plan.js";
import { rank } from "./rank.js";
import { withoutEmbedding, type MemoryData } from "../db/memory-data.js";

/** Deterministic subject/text search until the Voyage/Atlas vector integration lands. */
export function recallMemory(data: MemoryData, request: RecallRequest) {
  const query = request.query.trim().toLowerCase();
  if (!query) throw new RangeError("Query must not be blank");
  const states = data.beliefStates.filter(
    (s) =>
      s.condition === request.condition &&
      (s.status === "active" || s.status === "cracked"),
  );
  const captures = data.captureStates.filter(
    (s) => s.condition === request.condition,
  );
  const candidates = states.flatMap((state) => {
    const belief = data.beliefs.find((b) => b._id === state.belief_id);
    if (!belief || (request.rooms && !request.rooms.includes(belief.room)))
      return [];
    const exact = belief.triple.s.toLowerCase() === query;
    const text =
      `${belief.text} ${belief.triple.s} ${belief.triple.o}`.toLowerCase();
    const tokens = query.split(/\s+/);
    const relevance = exact
      ? 1
      : (0.9 * tokens.filter((t) => text.includes(t)).length) / tokens.length;
    const evidence = captures.filter(
      (c) => belief.evidence.includes(c.capture_id) && c.ceiling !== null,
    );
    return [
      {
        id: belief._id,
        belief,
        state,
        exact,
        relevance,
        confidence: state.confidence,
        clarity: evidence.length
          ? Math.max(...evidence.map((c) => c.clarity))
          : 1,
      },
    ];
  });
  const exact = candidates.filter((c) => c.exact);
  const matches = rank(exact.length ? exact : candidates, request.limit);
  const ids = new Set(matches.map((m) => m.item.id));
  const supporting = data.edges
    .filter((e) => e.type === "derived_from" && ids.has(e.from))
    .map((e) => e.to);
  const recalled = new Set<string>();
  const recalledCaptures = new Set<string>();
  const log = (
    target_type: Recall["target_type"],
    target_id: string,
    cascaded_from?: string,
  ) => {
    recalled.add(target_id);
    if (!request.dry_run)
      data.recalls.push({
        _id: ulid(),
        condition: request.condition,
        target_type,
        target_id,
        day: data.day,
        by: request.by,
        reason: request.reason,
        dry_run: false,
        ...(cascaded_from ? { cascaded_from } : {}),
      });
  };
  for (const id of new Set([...ids, ...supporting])) {
    const belief = data.beliefs.find((b) => b._id === id);
    const state = states.find((s) => s.belief_id === id);
    if (!belief || !state) continue;
    const plan = planRecall(
      request.condition,
      data.day,
      state,
      belief.c0,
      captures.filter((c) => belief.evidence.includes(c.capture_id)),
      recalledCaptures,
    );
    log("belief", id);
    if (!request.dry_run) Object.assign(state, plan.belief);
    for (const next of plan.captures) {
      recalledCaptures.add(next.capture_id);
      log("capture", next.capture_id, id);
      if (!request.dry_run)
        Object.assign(
          captures.find((c) => c.capture_id === next.capture_id)!,
          next,
        );
    }
  }
  return RecallResponse.parse({
    beliefs: matches.map(({ item, score }) => ({
      ...withoutEmbedding(item.belief),
      confidence: item.state.confidence,
      score,
      ...(request.with_images
        ? {
            evidence_images: item.belief.evidence.map((id) => {
              const state = captures.find((c) => c.capture_id === id);
              return {
                capture_id: id,
                served_level: state
                  ? servedLevel(state.alive_levels, state.clarity)
                  : null,
                clarity: state?.clarity ?? 0,
                url: `/image/${encodeURIComponent(id)}?condition=${request.condition}`,
              };
            }),
          }
        : {}),
    })),
    procedures: [],
    recalled_ids: [...recalled],
  });
}

export interface Searcher {
  search(req: RecallRequest): Promise<ReturnType<typeof recallMemory>>;
}
export function createSearcher(
  store: import("../db/memory-store.js").MemoryStore,
): Searcher {
  return {
    search: (req) => store.run(!req.dry_run, (data) => recallMemory(data, req)),
  };
}
