/**
 * Recall: read the 2D map to pick rooms, exact subject match first, $vectorSearch fallback, rank,
 * return beliefs plus evidence at current clarity, log the recall (unless dry_run).
 * docs/spec.md > The agent > Recall; > Evaluation (dry_run).
 */
import type { RecallRequest } from "@cortex/schema";
import { NotImplemented } from "../lib/errors.js";
import type { Repo } from "../db/repo.js";
import type { Embedder } from "./embed.js";

export interface Searcher {
  search(req: RecallRequest): Promise<{ beliefIds: string[]; recalledIds: string[] }>;
}

export function createSearcher(_repo: Repo, _embedder: Embedder): Searcher {
  return {
    async search() {
      throw new NotImplemented("recall/search");
    },
  };
}
