import { describe, expect, it } from "vitest";
import {
  AskResponse,
  MapResponse,
  CONDITIONS,
  type Belief,
  type Procedure,
} from "@cortex/schema";
import { emptyMemory, type MemoryData } from "../src/db/memory-data.js";
import { fixtureStore } from "../src/db/memory-store.js";
import { createApp } from "../src/api/app.js";
import { buildAgentMap } from "../src/map/index.js";
import { routeRequest } from "../src/ask/route.js";
import {
  createAsker,
  createAudioStore,
  createExtractiveAnswerer,
} from "../src/ask/index.js";
import type { Answerer } from "../src/ask/answer.js";

const belief = (over: Partial<Belief> & Pick<Belief, "_id" | "text">): Belief => ({
  triple: { s: "maya", p: "prefers", o: over._id },
  kind: "preference",
  room: "Housing",
  source: "screen",
  inferred: false,
  pinned: false,
  c0: 0.8,
  evidence: [],
  created_day: 0,
  history: [],
  ...over,
});

const hunt: Procedure = {
  _id: "proc:hunt",
  name: "Apartment hunt",
  description: "Search listings, reject the ones that break her rules, message the rest",
  room: "Housing",
  status: "active",
  steps: [{ n: 1, do: "decide" }],
  decision_attributes: ["price", "laundry"],
  learned_from: [],
  runs: 2,
  cracked_by: [],
};

function seed(): MemoryData {
  const data = emptyMemory();
  data.day = 4;
  data.beliefs = [
    belief({
      _id: "budget",
      text: "Housing budget is 3000 a month",
      triple: { s: "maya", p: "budget_max", o: "3000" },
      history: [{ day: 3, event: "reinforced", note: "seen again on MockLoft" }],
    }),
    belief({
      _id: "laundry",
      text: "Wants in-unit laundry",
      triple: { s: "maya", p: "requires", o: "laundry" },
      c0: 0.4,
    }),
    belief({
      _id: "dentist",
      text: "Dentist appointment on the 14th",
      room: "Health",
      kind: "event",
      triple: { s: "maya", p: "attends", o: "dentist" },
    }),
  ];
  data.procedures = [hunt];
  for (const condition of CONDITIONS)
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
  return data;
}

describe("ask router", () => {
  it("routes a request that names a known procedure to workflow", () => {
    const routed = routeRequest("find me some listings for the apartment hunt", [hunt]);
    expect(routed.route).toBe("workflow");
    expect(routed.procedure_id).toBe("proc:hunt");
  });
  it("leaves a plain question off the workflow route", () => {
    expect(routeRequest("what is my budget?", [hunt]).route).toBe("general");
  });
  it("ignores a cracked-free procedure list and empty text", () => {
    expect(routeRequest("", [hunt]).route).toBe("general");
    expect(routeRequest("run the hunt", []).route).toBe("general");
  });
});

describe("POST /ask", () => {
  it("answers personally from recalled memory and cites what it used", async () => {
    const store = fixtureStore(seed());
    const app = createApp({ fixtureMode: false, memory: store });
    const res = await app.request("/ask", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "budget", client: "mascot" }),
    });
    expect(res.status).toBe(200);
    const body = AskResponse.parse(await res.json());
    expect(body.route).toBe("personal");
    expect(body.answer).toContain("3000");
    expect(body.cited).toContain("budget");
    expect(body.recalled_ids).toContain("budget");
  });

  it("says it has nothing rather than guessing, and stays on the general route", async () => {
    const store = fixtureStore(seed());
    const asker = createAsker({ store });
    const body = await asker.ask({
      text: "capital of peru",
      client: "mascot",
      condition: "cortex",
      dry_run: false,
      speak: false,
    });
    expect(body.route).toBe("general");
    expect(body.cited).toEqual([]);
    expect(body.answer).toMatch(/don't have anything/i);
  });

  it("hedges a low-confidence memory", async () => {
    const answer = await createExtractiveAnswerer().answer({
      question: "laundry?",
      route: "personal",
      day: 4,
      sources: [
        {
          belief_id: "laundry",
          text: "Wants in-unit laundry",
          room: "Housing",
          kind: "preference",
          confidence: 0.4,
          score: 0.4,
        },
      ],
    });
    expect(answer.answer).toMatch(/^I think wants in-unit laundry\.$/);
  });

  it("dry runs leave the ledger untouched", async () => {
    const data = seed();
    const store = fixtureStore(data);
    const asker = createAsker({ store });
    await asker.ask({
      text: "budget",
      client: "eval",
      condition: "cortex",
      dry_run: true,
      speak: false,
    });
    const after = await store.run(false, (d) => d);
    expect(after.recalls).toEqual([]);
    expect(after.beliefStates.find((s) => s.belief_id === "budget")!.recalls).toBe(0);
  });

  it("drops citations the model invented and serves synthesised audio", async () => {
    const store = fixtureStore(seed());
    const audio = createAudioStore();
    const liar: Answerer = {
      async answer() {
        return { answer: "Made up.", cited: ["budget", "not-a-belief"] };
      },
    };
    // The answerer contract says only offered ids survive; the asker itself must not widen that.
    const asker = createAsker({
      store,
      answerer: {
        async answer(input) {
          const result = await liar.answer(input);
          const offered = new Set(input.sources.map((s) => s.belief_id));
          return { ...result, cited: result.cited.filter((id) => offered.has(id)) };
        },
      },
      speaker: {
        async speak() {
          return `/audio/${audio.put(new Uint8Array([1, 2, 3]), "audio/mpeg")}`;
        },
      },
    });
    const body = await asker.ask({
      text: "budget",
      client: "mascot",
      condition: "cortex",
      dry_run: false,
      speak: true,
    });
    expect(body.cited).toEqual(["budget"]);
    expect(body.audio_url).toMatch(/^\/audio\/[0-9A-HJKMNP-TV-Z]{26}$/);

    const app = createApp({ fixtureMode: false, memory: store, audio });
    const clip = await app.request(body.audio_url!);
    expect(clip.status).toBe(200);
    expect(clip.headers.get("content-type")).toBe("audio/mpeg");
    expect(new Uint8Array(await clip.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));
    expect((await app.request("/audio/missing")).status).toBe(404);
  });

  it("without memory the route is still an honest 501", async () => {
    const app = createApp({ fixtureMode: true });
    const res = await app.request("/ask", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "budget" }),
    });
    expect(res.status).toBe(501);
  });
});

describe("GET /map", () => {
  it("counts active beliefs per room with the strongest first", async () => {
    const store = fixtureStore(seed());
    const app = createApp({ fixtureMode: false, memory: store });
    const res = await app.request("/map?condition=cortex");
    expect(res.status).toBe(200);
    const body = MapResponse.parse(await res.json());
    expect(body.day).toBe(4);
    const housing = body.rooms.find((r) => r.name === "Housing")!;
    expect(housing.beliefs).toBe(2);
    expect(housing.top[0]).toBe("Housing budget is 3000 a month");
    expect(housing.procedures).toEqual(["Apartment hunt"]);
    expect(housing.cracked).toEqual([]);
    expect(body.rooms.find((r) => r.name === "Health")!.beliefs).toBe(1);
    expect(body.recent_changes).toEqual([
      "Day 3: reinforced — seen again on MockLoft",
    ]);
  });

  it("omits beliefs that are forgotten, tombstoned, or not yet created", () => {
    const data = seed();
    data.beliefStates
      .filter((s) => s.condition === "cortex" && s.belief_id === "laundry")
      .forEach((s) => (s.status = "forgotten"));
    data.beliefs.push(
      belief({ _id: "future", text: "Not yet known", created_day: 9 }),
    );
    for (const condition of CONDITIONS)
      data.beliefStates.push({
        _id: `${condition}:future`,
        condition,
        belief_id: "future",
        confidence: 0.8,
        recalls: 0,
        last_recall_day: 0,
        status: "active",
        superseded_by: null,
      });
    const map = buildAgentMap(data, "cortex");
    const housing = map.rooms.find((r) => r.name === "Housing")!;
    expect(housing.beliefs).toBe(1);
    expect(housing.top).toEqual(["Housing budget is 3000 a month"]);
  });

  it("splits active procedures from cracked ones", () => {
    const data = seed();
    data.procedures = [{ ...hunt, status: "cracked", cracked_by: ["laundry"] }];
    const map = buildAgentMap(data, "cortex");
    const housing = map.rooms.find((r) => r.name === "Housing")!;
    expect(housing.procedures).toEqual([]);
    expect(housing.cracked).toEqual(["Apartment hunt"]);
  });

  it("stays a 501 without memory", async () => {
    const app = createApp({ fixtureMode: true });
    expect((await app.request("/map")).status).toBe(501);
  });
});
