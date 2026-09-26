import { WsEvent } from "@cortex/schema";
import { describe, expect, it } from "vitest";
import { reduceSnapshot } from "../reducer";
import type { PalaceSnapshot } from "../types";
import { generateFixture } from "./generate";
import { createTicker } from "./ticker";

describe("createTicker", () => {
  it("emits 50 events that all parse as WsEvent, applied against a live snapshot", () => {
    let snapshot: PalaceSnapshot = generateFixture(42);
    const emitted: WsEvent[] = [];
    const ticker = createTicker(42, () => snapshot, (e) => emitted.push(e), { now: () => "2026-09-26T00:00:00.000Z" });
    const types = new Set<string>();
    for (let i = 0; i < 50; i++) {
      const e = ticker.next();
      expect(e).not.toBeNull();
      if (!e) break;
      const parsed = WsEvent.safeParse(e);
      expect(parsed.success, parsed.success ? "" : parsed.error.message).toBe(true);
      types.add(e.type);
      snapshot = reduceSnapshot(snapshot, e, () => null).snapshot;
    }
    expect(types.has("belief.recalled")).toBe(true);
    expect(types.has("capture.recalled")).toBe(true);
    expect(types.has("belief.reinforced")).toBe(true);
    expect(emitted).toHaveLength(0);
    expect(ticker.running).toBe(false);
  });

  it("is deterministic for a seed", () => {
    const a = createTicker(9, () => generateFixture(42), () => undefined, { now: () => "2026-09-26T00:00:00.000Z" });
    const b = createTicker(9, () => generateFixture(42), () => undefined, { now: () => "2026-09-26T00:00:00.000Z" });
    for (let i = 0; i < 20; i++) expect(a.next()).toEqual(b.next());
  });

  it("heals a procedure after cracking it", () => {
    const ticker = createTicker(3, () => generateFixture(42), () => undefined, { now: () => "2026-09-26T00:00:00.000Z" });
    const seen: string[] = [];
    for (let i = 0; i < 400 && !seen.includes("procedure.healed"); i++) {
      const e = ticker.next();
      if (e) seen.push(e.type);
    }
    const crackedAt = seen.indexOf("procedure.cracked");
    expect(crackedAt).toBeGreaterThanOrEqual(0);
    expect(seen.indexOf("procedure.healed")).toBeGreaterThan(crackedAt);
  });

  it("starts and stops without emitting synchronously", () => {
    const ticker = createTicker(1, () => generateFixture(42), () => undefined);
    ticker.start();
    expect(ticker.running).toBe(true);
    ticker.stop();
    expect(ticker.running).toBe(false);
  });
});
