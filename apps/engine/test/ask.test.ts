import { describe, expect, it } from "vitest";
import { z } from "zod";
import { AskResponse, MapResponse } from "@cortex/schema";
import type { Llm, StructuredRequest } from "../src/ai/structured.js";
import { createApp } from "../src/api/app.js";
import { createAsker } from "../src/ask/index.js";
import { fixtureStore } from "../src/db/memory-store.js";
import { applyExtraction } from "../src/extraction/apply.js";
import { createIntake } from "../src/ingest/intake.js";
import { buildMap } from "../src/map/index.js";
import { createRouter, heuristicRoute } from "../src/router/index.js";
import { createAudioStore, createTts, PREMADE_VOICE } from "../src/voice/tts.js";
import { testImage } from "./helpers.js";

/** A fake model: routes by keyword, answers by citing the first context entry plus a bogus one. */
function fakeLlm(): Llm & { calls: StructuredRequest<z.ZodType>[] } {
  const calls: StructuredRequest<z.ZodType>[] = [];
  return {
    calls,
    async parse<T extends z.ZodType>(request: StructuredRequest<T>) {
      calls.push(request as StructuredRequest<z.ZodType>);
      const shape = request.schema as z.ZodType;
      const out = (value: unknown) => ({ output: shape.parse(value) as z.infer<T>, stopReason: "end_turn" });
      if (shape.safeParse({ route: "personal", procedure_name: null }).success) {
        const text = String((request.messages[0]?.content as string) ?? "");
        return out({ route: /broker fee/i.test(text) ? "general" : "personal", procedure_name: null });
      }
      if (shape.safeParse({ answer: "x", cited: [1, 99] }).success) return out({ answer: "Your budget is $2,800 a month.", cited: [1, 99] });
      return out({ answer: "A broker fee is what a broker charges." });
    },
  };
}

async function seededStore() {
  const store = fixtureStore();
  const intake = createIntake(store);
  const { capture_id } = await intake.ingest(await testImage(400, 300), {
    episode_id: "hunt1-day2",
    day: 2,
    actor: "maya",
    app: "mockloft",
    url: "http://mock/listings",
    title: "MockLoft",
    action: { type: "load" },
  });
  await store.run(true, (d) =>
    applyExtraction(d, capture_id, {
      beliefs: [
        { s: "maya", p: "budget_max", o: "2800", text: "Maya's budget is at most $2,800 a month", kind: "fact", room: "Housing" },
        { s: "maya", p: "messaged", o: "listing:101", text: "Maya messaged the landlord of listing 101", kind: "event", room: "Housing" },
      ],
      listing: null,
    }),
  );
  return store;
}

describe("router", () => {
  it("heuristic: personal for questions about Maya, general otherwise, workflow only with a matching procedure", () => {
    expect(heuristicRoute("What is my budget?", []).route).toBe("personal");
    expect(heuristicRoute("What's a broker fee?", []).route).toBe("general");
    expect(heuristicRoute("Find me apartments", []).route).toBe("personal");
    expect(heuristicRoute("How tall is the Empire State Building?", []).route).toBe("general");
    const proc = [{ _id: "p1", name: "apartment_hunt", description: "Search listings" }];
    expect(heuristicRoute("Find me apartments", proc)).toEqual({ route: "workflow", procedure_id: "p1" });
    expect(heuristicRoute("run the apartment hunt", proc).procedure_id).toBe("p1");
  });
  it("model router falls back to personal when it names an unknown procedure", async () => {
    const llm: Llm = {
      parse: async <T extends z.ZodType>(r: StructuredRequest<T>) => ({ output: (r.schema as z.ZodType).parse({ route: "workflow", procedure_name: "nope" }) as z.infer<T>, stopReason: "end_turn" }),
    };
    expect(await createRouter(llm).route("Find me apartments", [])).toEqual({ route: "personal" });
  });
});

describe("map", () => {
  it("builds the agent map with per-room counts and top beliefs", async () => {
    const store = await seededStore();
    const map = await store.run(false, (d) => buildMap(d, "cortex"));
    expect(() => MapResponse.parse(map)).not.toThrow();
    const housing = map.rooms.find((r) => r.name === "Housing")!;
    expect(housing.beliefs).toBe(2);
    expect(housing.top.length).toBe(2);
    expect(map.recent_changes.length).toBe(2);
  });
});

describe("ask", () => {
  it("answers personal questions with citations limited to recalled beliefs and logs the recall", async () => {
    const store = await seededStore();
    const llm = fakeLlm();
    const asker = createAsker({ store, llm, router: createRouter(llm), model: "claude-opus-5" });
    const res = await asker.ask({ text: "What is my budget?", client: "mascot", condition: "cortex", dry_run: false, speak: false });
    expect(() => AskResponse.parse(res)).not.toThrow();
    expect(res.route).toBe("personal");
    expect(res.answer).toContain("2,800");
    expect(res.cited).toHaveLength(1);
    expect(res.recalled_ids).toContain(res.cited[0]!);
    await store.run(false, (d) => {
      expect(d.recalls.length).toBeGreaterThan(0);
      const state = d.beliefStates.find((s) => s.condition === "cortex" && s.belief_id === res.cited[0]);
      expect(state?.recalls).toBe(1);
    });
    const system = llm.calls.at(-1)!.system;
    expect(system).toContain("Memory map");
    expect(system).toContain("Relevant memories");
  });

  it("dry_run recalls nothing and general questions never touch memory", async () => {
    const store = await seededStore();
    const llm = fakeLlm();
    const asker = createAsker({ store, llm, router: createRouter(llm) });
    const dry = await asker.ask({ text: "What is my budget?", client: "eval", condition: "cortex", dry_run: true, speak: false });
    expect(dry.recalled_ids.length).toBeGreaterThan(0);
    await store.run(false, (d) => expect(d.recalls).toHaveLength(0));
    const general = await asker.ask({ text: "What's a broker fee?", client: "mascot", condition: "cortex", dry_run: false, speak: false });
    expect(general.route).toBe("general");
    expect(general.cited).toEqual([]);
    expect(general.recalled_ids).toEqual([]);
  });

  it("speak returns an audio url served by the app, and unknown audio is 404", async () => {
    const store = await seededStore();
    const llm = fakeLlm();
    const audio = createAudioStore();
    const calls: string[] = [];
    const fetchFn: typeof fetch = async (url) => {
      calls.push(String(url));
      if (String(url).includes("/library-voice")) return new Response("paid plan", { status: 402 });
      return new Response(new Uint8Array([1, 2, 3]), { status: 200 });
    };
    const tts = createTts({ apiKey: "k", voiceId: "library-voice", store: audio, fetchFn });
    const asker = createAsker({ store, llm, router: createRouter(llm), tts });
    const app = createApp({ fixtureMode: true, memory: store, asker, audio, router: createRouter(llm) });
    const res = await app.request("/ask", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: "What is my budget?", client: "mascot", speak: true }) });
    expect(res.status).toBe(200);
    const body = AskResponse.parse(await res.json());
    expect(body.audio_url).toMatch(/^\/audio\//);
    expect(calls[0]).toContain("library-voice");
    expect(calls[1]).toContain(PREMADE_VOICE);
    const served = await app.request(body.audio_url!);
    expect(served.status).toBe(200);
    expect(served.headers.get("content-type")).toBe("audio/mpeg");
    expect((await app.request("/audio/nope")).status).toBe(404);
    const routed = await app.request("/route", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: "What is my budget?" }) });
    expect(await routed.json()).toEqual({ route: "personal" });
    const map = await app.request("/map?condition=cortex");
    expect(map.status).toBe(200);
  });

  it("/ask is 503 with a memory store but no model", async () => {
    const app = createApp({ fixtureMode: true, memory: fixtureStore() });
    const res = await app.request("/ask", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: "hi" }) });
    expect(res.status).toBe(503);
  });
});
