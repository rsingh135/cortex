/**
 * Splits pretty-printed JSON into typed tokens so the /map page can colour keys, strings, numbers
 * and punctuation without a syntax-highlighting dependency. Pure; whitespace is kept verbatim so the
 * joined token text equals the input.
 */

export type JsonTokenType = "key" | "string" | "number" | "literal" | "punctuation" | "whitespace";

export interface JsonToken {
  type: JsonTokenType;
  text: string;
}

const STRING = /^"(?:[^"\\]|\\.)*"/;
const NUMBER = /^-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/;
const LITERAL = /^(?:true|false|null)\b/;
const WHITESPACE = /^\s+/;

export function tokenizeJson(source: string): JsonToken[] {
  const tokens: JsonToken[] = [];
  let rest = source;
  while (rest.length > 0) {
    let match = WHITESPACE.exec(rest);
    if (match) {
      tokens.push({ type: "whitespace", text: match[0] });
      rest = rest.slice(match[0].length);
      continue;
    }
    match = STRING.exec(rest);
    if (match) {
      const after = rest.slice(match[0].length);
      tokens.push({ type: /^\s*:/.test(after) ? "key" : "string", text: match[0] });
      rest = after;
      continue;
    }
    match = NUMBER.exec(rest);
    if (match) {
      tokens.push({ type: "number", text: match[0] });
      rest = rest.slice(match[0].length);
      continue;
    }
    match = LITERAL.exec(rest);
    if (match) {
      tokens.push({ type: "literal", text: match[0] });
      rest = rest.slice(match[0].length);
      continue;
    }
    // Any other single character: braces, brackets, commas, colons, or stray input.
    tokens.push({ type: "punctuation", text: rest[0] });
    rest = rest.slice(1);
  }
  return tokens;
}
