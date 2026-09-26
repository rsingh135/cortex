import { Snapshot, type Room, type Predicate } from "@cortex/schema";

/** Explicit, local preview data. Never written to the engine or presented as live memory. */
export function graphDemo() {
  const items: Array<[Room, string, Predicate, string]> = [
    ["Housing", "Keep rent below $3,000", "budget_max", "3000"],
    ["Housing", "A short walk to the subway", "prefers", "nearby transit"],
    ["Housing", "Natural light matters", "prefers", "natural light"],
    ["Housing", "An elevator above the third floor", "requires", "elevator"],
    ["Housing", "A home for a future cat", "getting_pet", "cat"],
    ["Housing", "Move before the lease ends", "has_event", "move"],
    ["Work", "Office near Union Square", "works_near", "union_square"],
    ["Work", "Focus time on Tuesday mornings", "prefers", "focus time"],
    ["Work", "Keep messages short and warm", "writes_like", "concise"],
    ["Social", "Dinner with Priya", "has_event", "dinner"],
    ["Social", "Priya knows the neighborhood", "knows", "priya"],
    ["Social", "A park for weekend walks", "prefers", "parks"],
    ["Health", "Morning walks before work", "prefers", "morning walks"],
    ["Health", "A quiet place to rest", "prefers", "quiet"],
    ["Errands", "Laundry in the building", "requires", "laundry"],
    ["Errands", "Groceries along the commute", "prefers", "nearby groceries"],
    ["Misc", "Save the moving checklist", "pinned", "checklist"],
    ["Misc", "A month of apartment hunting", "summary", "apartment hunt"],
  ];
  const ts = "2026-09-26T12:00:00.000Z";
  return Snapshot.parse({
    id: "demo-snapshot",
    type: "snapshot",
    day: 24,
    ts,
    condition: "cortex",
    payload: {
      beliefs: items.map(([room, text, p, o], i) => ({
        _id: `demo-belief-${i}`,
        triple: { s: "maya", p, o },
        text,
        kind:
          p === "summary"
            ? "summary"
            : p === "has_event"
              ? "event"
              : "preference",
        room,
        source: i === 16 ? "manual" : "screen",
        inferred: i === 4,
        pinned: i === 5 || i === 16,
        c0: 0.9,
        confidence: [0.94, 0.82, 0.71, 0.9, 0.56][i % 5],
        evidence: [`demo-capture-${i}`],
        created_day: 1 + i,
        history: [
          {
            day: 1 + i,
            event: "created",
            note: "Illustrative memory for the demo",
          },
        ],
        status: "active",
      })),
      captures: items.map(([room, text], i) => ({
        _id: `demo-capture-${i}`,
        episode_id: `demo-episode-${room}`,
        day: 1 + i,
        ts,
        actor: "maya",
        app:
          room === "Housing"
            ? "mockloft"
            : room === "Work"
              ? "inbox"
              : "calendar",
        title: `${room} · ${text}`,
        url: "",
        action: { type: "load" },
        phash: "0",
        extracted: true,
        belief_ids: [`demo-belief-${i}`],
        l0_bytes: 120000,
        alive_levels: ["L1", "L2", "L3"],
        ceiling: "L1",
        clarity: 0.5 + (i % 5) / 10,
      })),
      procedures: [
        {
          _id: "demo-procedure",
          name: "Find an apartment",
          description: "Compare listings using Maya's housing preferences.",
          room: "Housing",
          status: "active",
          steps: [
            {
              n: 1,
              do: "Check price and location",
              uses: ["demo-belief-0", "demo-belief-1"],
            },
            {
              n: 2,
              do: "Check access and amenities",
              uses: ["demo-belief-3", "demo-belief-14"],
            },
          ],
          decision_attributes: ["price", "elevator", "laundry"],
          learned_from: ["demo-episode-Housing"],
          runs: 3,
          cracked_by: [],
        },
      ],
      edges: [0, 1, 3, 14].map((i) => ({
        _id: `demo-uses-${i}`,
        from: "demo-procedure",
        to: `demo-belief-${i}`,
        type: "uses",
        weight: 1,
      })),
    },
  });
}
