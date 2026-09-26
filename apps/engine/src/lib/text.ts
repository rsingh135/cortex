/**
 * Shared query tokenisation for recall and routing.
 *
 * Both had their own idea of what a word is, and recall's was punctuation-blind: it split on
 * whitespace and matched with substring `includes`, so "what's my budget?" found nothing (the token
 * was "budget?") while "who won the world cup in 1994?" matched everything (the token "in" is inside
 * "Housing"). Word-boundary matching over content words fixes both directions.
 */

/** Words that carry no topic, so they never count as evidence that a memory matches. */
export const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "but", "if", "then", "than", "so", "as", "at",
  "by", "for", "from", "in", "into", "of", "on", "onto", "to", "with", "about",
  "my", "me", "mine", "i", "you", "your", "yours", "it", "its", "that", "this",
  "these", "those", "there", "here", "what", "whats", "which", "who", "whom",
  "whose", "when", "where", "why", "how", "is", "are", "was", "were", "be",
  "been", "being", "am", "do", "does", "did", "have", "has", "had", "can",
  "could", "will", "would", "should", "shall", "may", "might", "must", "any",
  "some", "all", "no", "not", "just", "like", "want", "please", "again", "up",
  "out", "get", "got", "much", "many", "more", "most", "very", "too", "own",
]);

/** Lowercased alphanumeric runs. Punctuation, possessives and hyphens all become boundaries. */
export function tokenize(text: string): string[] {
  return text.toLowerCase().match(/[a-z0-9]+/g) ?? [];
}

/** Tokens worth scoring on: long enough to mean something, and not a stopword. */
export function contentWords(tokens: readonly string[]): string[] {
  return tokens.filter((token) => token.length > 2 && !STOPWORDS.has(token));
}

/**
 * Tokens to score a query by: its content words, or every token when a query is nothing but
 * short or common words (so "my dog" still searches for "dog" rather than for nothing).
 */
export function queryTerms(query: string): string[] {
  const tokens = tokenize(query);
  const content = contentWords(tokens);
  return content.length ? content : tokens;
}

/**
 * Share of `terms` present in `text` as whole words, 0..1.
 * Whole words matter: "in" must not match "Housing".
 */
export function termOverlap(terms: readonly string[], text: string): number {
  if (!terms.length) return 0;
  const present = new Set(tokenize(text));
  let matched = 0;
  for (const term of terms) if (present.has(term)) matched += 1;
  return matched / terms.length;
}
