import { WRITE_TOKEN_HEADER } from "@cortex/schema";

/**
 * Mock-world writes require the shared token. Returns true when the request header equals the
 * configured token. A missing server token denies every write, so a misconfigured deploy fails closed.
 */
export function isAuthorized(headerValue: string | null | undefined, expected: string | undefined): boolean {
  if (!expected || expected.length === 0) return false;
  if (!headerValue) return false;
  return timingSafeEqualString(headerValue, expected);
}

export function tokenFromHeaders(headers: Headers): string | null {
  return headers.get(WRITE_TOKEN_HEADER);
}

function timingSafeEqualString(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
