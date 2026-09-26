import type { Context } from "hono";
import type { z } from "zod";

export type Validated<T> = { ok: true; data: T } | { ok: false; response: Response };

/** Parse a JSON body against a zod schema; 400 with issues on failure. */
export async function validateJson<T>(c: Context, schema: z.ZodType<T>): Promise<Validated<T>> {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return { ok: false, response: c.json({ error: "invalid JSON body" }, 400) };
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return { ok: false, response: c.json({ error: "validation failed", issues: parsed.error.issues }, 400) };
  return { ok: true, data: parsed.data };
}

export function validateQuery<T>(c: Context, schema: z.ZodType<T>): Validated<T> {
  const parsed = schema.safeParse(c.req.query());
  if (!parsed.success) return { ok: false, response: c.json({ error: "validation failed", issues: parsed.error.issues }, 400) };
  return { ok: true, data: parsed.data };
}
