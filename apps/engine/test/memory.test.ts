import { describe, expect, it } from "vitest";
import {
  CONDITIONS,
  LEVELS,
  Snapshot,
  RecallResponse,
  AdvanceClockResponse,
  RecallRequest,
  type Belief,
} from "@cortex/schema";
import { emptyMemory } from "../src/db/memory-data.js";
import { fixtureStore } from "../src/db/memory-store.js";
import { createApp } from "../src/api/app.js";
import { advanceMemory } from "../src/forgetting/sweep.js";
import { recallMemory } from "../src/recall/search.js";

function seed() {
  const data = emptyMemory();
  const belief: Belief = {
    _id: "budget",
    triple: { s: "maya", p: "budget_max", o: "3000" },
    text: "Housing budget 3000",
    kind: "preference",
    room: "Housing",
    source: "screen",
    inferred: false,
    pinned: false,
    c0: 0.8,
    evidence: ["capture"],
    created_day: 0,
    history: [],
    embedding: [1, 2],
  };
  data.beliefs = [
    belief,
    {
      ...belief,
      _id: "laundry",
      text: "Housing needs laundry",
      triple: { s: "maya", p: "requires", o: "laundry" },
    },
  ];
  data.captures = [
    {
      _id: "capture",
      episode_id: "episode",
      day: 0,
      ts: "2026-09-26T00:00:00.000Z",
      actor: "maya",
      app: "mockloft",
      url: "",
      title: "Housing",
      action: { type: "load" },
      phash: "0",
      extracted: true,
      belief_ids: ["budget", "laundry"],
      l0_bytes: 4,
      page_text: "private raw text",
    },
  ];
  data.levels = LEVELS.map((level) => ({
    _id: level,
    capture_id: "capture",
    level,
    width: 1,
    height: 1,
    bytes: 4,
    data: new Uint8Array([1, 2, 3, 4]),
  }));
  for (const condition of CONDITIONS) {
    data.captureStates.push({
      _id: condition,
      condition,
      capture_id: "capture",
      alive_levels: [...LEVELS],
      ceiling: "L0",
      clarity: 1,
      recalls: 0,
      last_recall_day: 0,
    });
    for (const b of data.beliefs)
      data.beliefStates.push({
        _id: `${condition}:${b._id}`,
        condition,
        belief_id: b._id,
        confidence: b.c0,
        recalls: 0,
        last_recall_day: 0,
        status: "active",
        superseded_by: null,
      });
  }
  return data;
}
const request = (extra = {}) =>
  RecallRequest.parse({
    query: "maya",
    by: "agent",
    reason: "test",
    with_images: true,
    ...extra,
  });

describe("memory integration", () => {
  it("dry runs return valid responses without changing any state or writing logs", () => {
    const data = seed();
    advanceMemory(data, 3);
    const before = structuredClone(data);
    const response = recallMemory(data, request({ dry_run: true }));
    expect(RecallResponse.safeParse(response).success).toBe(true);
    expect(response.beliefs).toHaveLength(2);
    expect(data).toEqual(before);
  });
  it("recalls shared evidence once and never resurrects deleted levels", () => {
    const data = seed();
    advanceMemory(data, 3);
    recallMemory(data, request());
    const capture = data.captureStates.find((s) => s.condition === "cortex")!;
    expect(capture.recalls).toBe(1);
    expect(capture.clarity).toBe(0.75);
    expect(capture.alive_levels).not.toContain("L0");
    expect(
      data.recalls.filter((r) => r.target_type === "capture"),
    ).toHaveLength(1);
    advanceMemory(data, 6);
    expect(capture.alive_levels).not.toContain("L0");
    expect(capture.alive_levels).toContain("L1");
    expect(
      data.captureStates.find((s) => s.condition === "blur_by_age")!
        .alive_levels,
    ).not.toContain("L1");
  });
  it("preserves baseline clocks on recall and canonical images on sweep", () => {
    const data = seed();
    advanceMemory(data, 3);
    const before = structuredClone(data.captureStates);
    recallMemory(data, request({ condition: "blur_by_age" }));
    expect(data.captureStates).toEqual(before);
    const response = advanceMemory(data, 100);
    expect(AdvanceClockResponse.safeParse(response).success).toBe(true);
    expect(response.per_condition.keep_all.image_bytes).toBe(16);
    expect(response.per_condition.cortex.image_bytes).toBe(0);
    expect(data.levels).toHaveLength(4);
    expect(
      data.beliefStates.find((s) => s.condition === "cortex")!.status,
    ).toBe("forgotten");
  });
  it("excludes inactive beliefs", () => {
    const data = seed();
    data.beliefStates.find((s) => s._id === "cortex:laundry")!.status =
      "tombstoned";
    expect(recallMemory(data, request()).beliefs.map((b) => b._id)).toEqual([
      "budget",
    ]);
  });
  it("follows derived evidence one hop and protects pinned and keep-all beliefs", () => {
    const data = seed();
    const base = data.beliefs[0]!;
    data.beliefs.push({
      ...base,
      _id: "third",
      text: "unrelated",
      triple: { s: "third", p: "prefers", o: "quiet" },
      evidence: [],
    });
    data.beliefStates.push({
      ...data.beliefStates[0]!,
      _id: "cortex:third",
      belief_id: "third",
    });
    data.edges = [
      {
        _id: "one",
        from: "budget",
        to: "laundry",
        type: "derived_from",
        weight: 1,
      },
      {
        _id: "two",
        from: "laundry",
        to: "third",
        type: "derived_from",
        weight: 1,
      },
    ];
    const recalled = recallMemory(data, request({ query: "budget" }));
    expect(recalled.recalled_ids).toContain("laundry");
    expect(recalled.recalled_ids).not.toContain("third");
    base.pinned = true;
    base.c0 = 0.05;
    advanceMemory(data, 1000);
    expect(
      data.beliefStates.find((s) => s._id === "cortex:budget")!.status,
    ).toBe("active");
    expect(
      data.beliefStates.find((s) => s._id === "keep_all:budget")!.status,
    ).toBe("active");
    expect(data.stats).toHaveLength(3);
    data.stats[0]!._id = "existing-stat-id";
    advanceMemory(data, 1000);
    expect(data.stats).toHaveLength(3);
    expect(data.stats[0]!._id).toBe("existing-stat-id");
  });
  it("same-day sweeps are idempotent; rejected changes do not mutate storage", async () => {
    const store = fixtureStore(seed());
    await store.run(true, (d) => advanceMemory(d, 10));
    const again = await store.run(true, (d) => advanceMemory(d, 10));
    expect(again.per_condition.cortex.levels_deleted).toBe(0);
    const before = await store.run(false, (d) => d);
    await expect(store.run(true, (d) => advanceMemory(d, 9))).rejects.toThrow(
      "backwards",
    );
    expect(await store.run(false, (d) => d)).toEqual(before);
  });
  it("serves real snapshot, recall, clock and image routes with validation", async () => {
    const app = createApp({ fixtureMode: true, memory: fixtureStore(seed()) });
    const snapshot = await (await app.request("/snapshot")).json();
    expect(Snapshot.safeParse(snapshot).success).toBe(true);
    expect(JSON.stringify(snapshot)).not.toContain("private raw text");
    expect(JSON.stringify(snapshot)).not.toContain("embedding");
    expect((await app.request("/snapshot?condition=nope")).status).toBe(400);
    const post = (path: string, body: unknown) =>
      app.request(path, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
    expect((await post("/recall", request())).status).toBe(200);
    expect((await post("/recall", request({ query: " " }))).status).toBe(400);
    expect(
      (await app.request("/image/capture")).headers.get("content-type"),
    ).toBe("image/webp");
    expect((await post("/clock/advance", { to_day: 100 })).status).toBe(200);
    expect((await app.request("/image/capture")).status).toBe(404);
    expect(
      (await app.request("/image/capture?condition=keep_all")).status,
    ).toBe(200);
  });
});
