import { describe, expect, it } from "vitest";
import type { AskResponse } from "@cortex/schema";
import { initialState, reactionFor, reduce, type MascotState } from "../src/renderer/lib/store";
import type { MascotEvent } from "../src/shared/types";

const answer: AskResponse = { route: "personal", answer: "Priya's dinner is Oct 3.", cited: ["b1", "b2"], recalled_ids: ["b1", "b2"] };

const recalled: MascotEvent = {
  id: "e1",
  type: "belief.recalled",
  day: 24,
  ts: "2026-09-26T00:00:00.000Z",
  condition: "cortex",
  payload: { belief_id: "b1", confidence: 0.9, recalls: 3, reason: "asked" },
};
const forgotten: MascotEvent = { ...recalled, id: "e2", type: "belief.forgotten", payload: { belief_id: "b9", room: "Misc" } };

describe("mascot reducer", () => {
  it("walks a conversation turn idle -> thinking -> speaking -> idle", () => {
    let s: MascotState = reduce(initialState, { type: "asked", text: "When is Priya's dinner?" });
    expect(s.pet).toBe("thinking");
    expect(s.transcript).toHaveLength(1);
    s = reduce(s, { type: "answered", response: answer });
    expect(s.pet).toBe("speaking");
    expect(s.transcript[1]).toMatchObject({ role: "mascot", cited: 2 });
    s = reduce(s, { type: "doneSpeaking" });
    expect(s.pet).toBe("idle");
  });

  it("records failures and returns to idle", () => {
    const s = reduce(reduce(initialState, { type: "asked", text: "hi" }), { type: "failed", message: "engine down" });
    expect(s.pet).toBe("idle");
    expect(s.error).toBe("engine down");
  });

  it("reacts to engine events only when idle", () => {
    const reacting = reduce(initialState, { type: "engineEvent", event: recalled });
    expect(reacting).toMatchObject({ pet: "reacting", reaction: "nod" });
    expect(reduce(reacting, { type: "reactionDone" }).pet).toBe("idle");

    const thinking = reduce(initialState, { type: "asked", text: "x" });
    expect(reduce(thinking, { type: "engineEvent", event: forgotten })).toBe(thinking);
  });

  it("maps event types to reactions", () => {
    expect(reactionFor(recalled)).toBe("nod");
    expect(reactionFor(forgotten)).toBe("shiver");
    expect(
      reactionFor({
        ...recalled,
        type: "clock.advanced",
        payload: { from_day: 5, to_day: 24, levels_deleted: 1, bytes_freed: 1, captures_forgotten: 0, beliefs_decayed: 0, beliefs_forgotten: 3, rooms_dimmed: [] },
      }),
    ).toBe("shiver");
  });

  it("caps the transcript at 20 turns", () => {
    let s = initialState;
    for (let i = 0; i < 30; i++) s = reduce(s, { type: "asked", text: `q${i}` });
    expect(s.transcript).toHaveLength(20);
    expect(s.transcript[0]?.text).toBe("q10");
  });
});
