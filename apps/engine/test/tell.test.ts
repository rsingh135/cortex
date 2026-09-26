import { describe, expect, it } from "vitest";
import { z } from "zod";
import type { Llm, StructuredRequest } from "../src/ai/structured.js";
import { createAsker } from "../src/ask/index.js";
import { fallbackTell, guessRoom, isStatement } from "../src/ask/tell.js";
import { fixtureStore } from "../src/db/memory-store.js";
import { createRouter } from "../src/router/index.js";
import { snapshot } from "../src/live/snapshot.js";

describe("isStatement", () => {
  it("accepts first-person statements and rejects questions and requests", () => {
    expect(isStatement("I'm getting a dog next month")).toBe(true);
    expect(isStatement("My budget is now $3,000")).toBe(true);
    expect(isStatement("Remember that Priya is vegetarian")).toBe(true);
    expect(isStatement("Do I have any pets coming?")).toBe(false);
    expect(isStatement("What's my budget")).toBe(false);
    expect(isStatement("Find me apartments")).toBe(false);
    expect(isStatement("")).toBe(false);
  });
  it("fallback keeps her words and guesses predicate and room", () => {
    const out = fallbackTell("I'm getting a dog next month");
    expect(out.beliefs[0]).toMatchObject({ s: "maya", p: "getting_pet", o: "dog", room: "Housing" });
    expect(guessRoom("my dentist appointment moved")).toBe("Health");
    expect(guessRoom("something else entirely")).toBe("Misc");
  });
});

describe("what Maya tells Cortex is stored and recalled (no model)", () => {
  it("statement -> voice note + voice belief + states + evidence edge; question -> note only; follow-up recalls it", async () => {
    const store = fixtureStore();
    const asker = createAsker({ store });

    const told = await asker.ask({ text: "I'm getting a dog next month", client: "mascot", condition: "cortex", dry_run: false, speak: false });
    expect(told.route).toBe("personal");
    expect(told.answer).toMatch(/^Got it\. I'll remember/);
    expect(told.cited).toHaveLength(1);

    await store.run(false, (d) => {
      expect(d.voiceNotes).toHaveLength(1);
      expect(d.voiceNotes[0]!.transcript).toBe("I'm getting a dog next month");
      expect(d.voiceNotes[0]!.client).toBe("mascot");
      expect(d.voiceNotes[0]!.belief_ids).toEqual(told.cited);
      const belief = d.beliefs.find((b) => b._id === told.cited[0])!;
      expect(belief.source).toBe("voice");
      expect(belief.c0).toBe(0.9);
      expect(belief.evidence).toEqual([d.voiceNotes[0]!._id]);
      expect(d.beliefStates.filter((s) => s.belief_id === belief._id)).toHaveLength(3);
      expect(d.edges.some((e) => e.type === "evidence" && e.from === belief._id && e.to === d.voiceNotes[0]!._id)).toBe(true);
      // The palace sees it.
      expect(snapshot(d, "cortex").payload.beliefs.some((b) => b._id === belief._id)).toBe(true);
    });

    const asked = await asker.ask({ text: "Am I getting a dog?", client: "mascot", condition: "cortex", dry_run: false, speak: false });
    expect(asked.route).toBe("personal");
    expect(asked.cited).toContain(told.cited[0]);
    await store.run(false, (d) => {
      expect(d.voiceNotes).toHaveLength(2);
      expect(d.beliefs).toHaveLength(1);
    });

    // Words that do not overlap still surface what she said lately.
    const vague = await asker.ask({ text: "Anything new I should plan for?", client: "mascot", condition: "cortex", dry_run: false, speak: false });
    expect(vague.route).toBe("personal");
    expect(vague.cited).toContain(told.cited[0]);

    // Saying it again reinforces rather than duplicates.
    await asker.ask({ text: "I'm getting a dog next month", client: "mascot", condition: "cortex", dry_run: false, speak: false });
    await store.run(false, (d) => {
      expect(d.beliefs).toHaveLength(1);
      expect(d.beliefStates.find((s) => s.condition === "cortex")!.confidence).toBeGreaterThan(0.9);
    });
  });

  it("dry-run questions store nothing", async () => {
    const store = fixtureStore();
    const asker = createAsker({ store });
    await asker.ask({ text: "What is my budget?", client: "eval", condition: "cortex", dry_run: true, speak: false });
    await store.run(false, (d) => expect(d.voiceNotes).toHaveLength(0));
  });
});

describe("with a model", () => {
  it("statements use the model's beliefs, questions cite recently told beliefs when recall is empty", async () => {
    const calls: StructuredRequest<z.ZodType>[] = [];
    const llm: Llm = {
      async parse<T extends z.ZodType>(request: StructuredRequest<T>) {
        calls.push(request as StructuredRequest<z.ZodType>);
        const shape = request.schema as z.ZodType;
        const out = (value: unknown) => ({ output: shape.parse(value) as z.infer<T>, stopReason: "end_turn" });
        if (/Maya just told Cortex/.test(request.system))
          return out({ beliefs: [{ s: "maya", p: "getting_pet", o: "dog", text: "Maya is getting a dog, a pet, next month", kind: "fact", room: "Housing" }, { s: "maya", p: "requires", o: "pets_allowed", text: "Maya needs a pet-friendly apartment", kind: "preference", room: "Housing" }] });
        if (shape.safeParse({ route: "personal", procedure_name: null }).success) return out({ route: "personal", procedure_name: null });
        return out({ answer: "Yes, a dog is coming next month.", cited: [1] });
      },
    };
    const store = fixtureStore();
    const asker = createAsker({ store, llm, router: createRouter(llm) });
    const told = await asker.ask({ text: "I'm getting a dog next month", client: "mascot", condition: "cortex", dry_run: false, speak: false });
    expect(told.cited).toHaveLength(2);
    expect(told.answer).toMatch(/2 things/);
    await store.run(false, (d) => {
      expect(d.beliefs.find((b) => b.kind === "preference")?.inferred).toBe(true);
    });
    const asked = await asker.ask({ text: "Any pets in my future?", client: "mascot", condition: "cortex", dry_run: false, speak: false });
    expect(asked.cited).toHaveLength(1);
    expect(told.cited).toContain(asked.cited[0]);
    expect(asked.answer).toMatch(/dog/);
  });
});
