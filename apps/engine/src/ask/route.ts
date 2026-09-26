/**
 * Request router for POST /ask: general (world knowledge), personal (her own memory),
 * workflow (run a procedure she has already taught Cortex). docs/spec.md > The agent.
 *
 * Deterministic on purpose. The route decides whether a model call happens at all, so it must be
 * cheap, testable, and identical between the eval harness and the demo.
 */
import type { Procedure, RequestRoute } from "@cortex/schema";

/** Verbs that make a sentence a request to act rather than a question to answer. */
const ACTION_VERBS = new Set([
  "find", "run", "do", "hunt", "search", "look", "check", "message", "apply",
  "book", "reply", "draft", "send", "start", "go", "redo", "repeat", "again",
  "show", "get", "make", "write", "sort", "filter", "browse",
]);

/** Words that carry no topic, so they never count as evidence that a procedure matches. */
const STOPWORDS = new Set([
  "the", "a", "an", "my", "me", "for", "of", "to", "in", "on", "at", "is", "are",
  "was", "were", "what", "which", "who", "whom", "whose", "when", "where", "why",
  "how", "i", "you", "it", "its", "that", "this", "these", "those", "and", "or",
  "but", "with", "about", "from", "some", "any", "please", "can", "could",
  "would", "should", "will", "be", "been", "have", "has", "had", "did", "does",
  "do", "again", "up", "out", "all", "new", "more", "just", "like", "want",
]);

export const WORKFLOW_WITH_VERB = 0.3;
export const WORKFLOW_WITHOUT_VERB = 0.6;

export function tokenize(text: string): string[] {
  return text.toLowerCase().match(/[a-z0-9]+/g) ?? [];
}

const contentWords = (tokens: readonly string[]) =>
  new Set(tokens.filter((token) => token.length > 2 && !STOPWORDS.has(token)));

export interface RouteMatch {
  route: RequestRoute;
  procedure_id?: string;
  /** Token overlap with the best-matching procedure, for logging and tests. */
  score: number;
}

/**
 * Decides whether the text asks Cortex to *run* something. Personal versus general is settled later
 * by whether recall actually found anything, which is more honest than guessing from wording.
 */
export function routeRequest(
  text: string,
  procedures: readonly Procedure[],
): RouteMatch {
  const tokens = tokenize(text);
  const asked = contentWords(tokens);
  if (!asked.size) return { route: "general", score: 0 };
  const imperative = tokens.some((token) => ACTION_VERBS.has(token));
  const threshold = imperative ? WORKFLOW_WITH_VERB : WORKFLOW_WITHOUT_VERB;

  let best: { procedure: Procedure; score: number } | null = null;
  for (const procedure of procedures) {
    if (procedure.status !== "active" && procedure.status !== "cracked")
      continue;
    const owned = contentWords(
      tokenize(
        [
          procedure.name,
          procedure.description,
          procedure.room,
          ...procedure.decision_attributes,
        ].join(" "),
      ),
    );
    let shared = 0;
    for (const token of asked) if (owned.has(token)) shared += 1;
    const score = shared / asked.size;
    // Ties go to the procedure with the lower id so the route never depends on document order.
    if (
      score > 0 &&
      (!best ||
        score > best.score ||
        (score === best.score && procedure._id < best.procedure._id))
    )
      best = { procedure, score };
  }

  if (best && best.score >= threshold)
    return {
      route: "workflow",
      procedure_id: best.procedure._id,
      score: best.score,
    };
  return { route: "general", score: best?.score ?? 0 };
}
