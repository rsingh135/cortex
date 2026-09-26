/**
 * Resets the demo database to the seeded day-24 snapshot so the five beats can be rehearsed
 * from a known state. Not implemented in the foundations pass.
 *
 *   pnpm reset-demo-db [--to-day 24] [--snapshot path]
 */
import "dotenv/config";

export interface ResetOptions {
  toDay: number;
  snapshotPath: string;
}

export async function resetDemoDb(_opts: ResetOptions): Promise<void> {
  throw new Error("reset-demo-db: not implemented yet (foundations pass). See docs/spec.md > Demo ops.");
}

if (process.argv[1] && /reset-demo-db\.ts$/.test(process.argv[1])) {
  resetDemoDb({ toDay: 24, snapshotPath: "snapshots/day24" }).catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
