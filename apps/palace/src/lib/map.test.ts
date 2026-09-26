import { MapResponse, ROOMS } from "@cortex/schema";
import { describe, expect, it } from "vitest";
import { FIXTURE_IDS, generateFixture } from "./fixtures/generate";
import { createTicker } from "./fixtures/ticker";
import { agentMapJson, buildAgentMap } from "./map";

describe("buildAgentMap", () => {
  const snapshot = generateFixture(42);

  it("produces JSON that parses as MapResponse", () => {
    const parsed = MapResponse.parse(JSON.parse(agentMapJson(snapshot)));
    expect(parsed.day).toBe(24);
    expect(parsed.rooms.map((r) => r.name)).toEqual([...ROOMS]);
  });

  it("lists only active beliefs, top 4 per room, and cracked procedures", () => {
    const map = buildAgentMap(snapshot);
    const housing = map.rooms.find((r) => r.name === "Housing")!;
    expect(housing.top).toHaveLength(4);
    expect(housing.beliefs).toBe(snapshot.beliefs.filter((b) => b.room === "Housing" && b.status === "active").length);
    expect(housing.procedures).toEqual(["apartment_hunt", "schedule_viewings"]);
    expect(housing.cracked).toEqual(["schedule_viewings"]);
    const superseded = snapshot.beliefs.filter((b) => b.status === "superseded").map((b) => b.text);
    for (const t of superseded) expect(housing.top).not.toContain(t);
    expect(snapshot.beliefs.find((b) => b.id === FIXTURE_IDS.leasePinned)).toBeDefined();
  });

  it("describes recent events and stays small", () => {
    const ticker = createTicker(42, () => snapshot, () => undefined, { now: () => "2026-09-26T00:00:00.000Z" });
    const events = Array.from({ length: 10 }, () => ticker.next()!).reverse();
    const map = buildAgentMap(snapshot, events);
    expect(map.recent_changes.length).toBe(8);
    for (const line of map.recent_changes) expect(line.length).toBeGreaterThan(5);
    expect(JSON.stringify(map).length).toBeLessThan(3200);
  });
});
