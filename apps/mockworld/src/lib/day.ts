import { cookies } from "next/headers";

export const DAY_COOKIE = "cortex-day";
export const LAST_DAY = 30;

/**
 * The simulated day the mock world believes it is. Set by the Playwright runner (and the demo)
 * through the `cortex-day` cookie so Maya never sees mail or events from her future.
 * Defaults to the end of the month when unset.
 */
export async function currentDay(): Promise<number> {
  const raw = (await cookies()).get(DAY_COOKIE)?.value;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 1 && n <= LAST_DAY ? n : LAST_DAY;
}

/** "Priya <priya@example.com>" -> "Priya"; bare addresses stay as they are. */
export function displayName(from: string): string {
  const m = from.match(/^\s*([^<]+?)\s*<[^>]+>\s*$/);
  return m?.[1] ?? from;
}
