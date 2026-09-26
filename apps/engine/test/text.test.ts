/**
 * Regression tests for the two recall-matching bugs a live /ask run exposed:
 * a punctuated question found nothing, and an unrelated question matched everything.
 */
import { describe, expect, it } from "vitest";
import { CONDITIONS, type Belief } from "@cortex/schema";
import { queryTerms, termOverlap, tokenize } from "../src/lib/text.js";
import { emptyMemory, type MemoryData } from "../src/db/memory-data.js";
import { fixtureStore } from "../src/db/memory-store.js";
import { createAsker } from "../src/ask/index.js";

describe("query tokenisation", () => {
  it("strips punctuation and possessives", () => {
    expect(tokenize("what's my budget?")).toEqual(["what", "s", "my", "budget"]);
    expect(tokenize("in-unit laundry!")).toEqual(["in", "unit", "laundry"]);
  });
  it("keeps only topic words", () => {
    expect(queryTerms("what's my budget?")).toEqual(["budget"]);
    expect(queryTerms("who won the world cup in 1994?")).toEqual([
      "won", "world", "cup", "1994",
    ]);
  });
  it("falls back to every token when a query is all short or common words", () => {
    expect(queryTerms("my dog")).toEqual(["dog"]);
    expect(queryTerms("who am i")).toEqual(["who", "am", "i"]);
  });
  it("matches whole words only, so 'in' does not match 'Housing'", () => {
    expect(termOverlap(["in"], "Housing budget is 3000")).toBe(0);
    expect(termOverlap(["budget"], "Housing budget is 3000")).toBe(1);
    expect(termOverlap(["laundry"], "Needs in-unit laundry")).toBe(1);
    expect(termOverlap(["budget", "laundry"], "Housing budget is 3000")).toBe(0.5);
    expect(termOverlap([], "anything")).toBe(0);
  });
});

const belief = (o: Partial<Belief> & Pick<Belief, "_id" | "text">): Belief => ({
  triple: { s: "maya", p: "prefers", o: o._id }, kind: "preference", room: "Housing",
  source: "screen", inferred: false, pinned: false, c0: 0.85, evidence: [],
  created_day: 0, history: [], ...o,
});

function seed(): MemoryData {
  const data = emptyMemory();
  data.day = 24;
  data.beliefs = [
    belief({ _id: "budget", text: "Housing budget is at most $3,000 a month", triple: { s: "maya", p: "budget_max", o: "3000" } }),
    belief({ _id: "laundry", text: "Needs in-unit laundry", triple: { s: "maya", p: "requires", o: "laundry" } }),
  ];
  for (const c of CONDITIONS)
    for (const b of data.beliefs)
      data.beliefStates.push({ _id: `${c}:${b._id}`, condition: c, belief_id: b._id,
        confidence: b.c0, recalls: 0, last_recall_day: 0, status: "active", superseded_by: null });
  return data;
}

const ask = (text: string) =>
  createAsker({ store: fixtureStore(seed()) }).ask({
    text, client: "mascot", condition: "cortex", dry_run: false, speak: false,
  });

describe("/ask routing on natural questions", () => {
  it("finds a memory through the question mark", async () => {
    const body = await ask("what's my budget?");
    expect(body.route).toBe("personal");
    expect(body.cited).toContain("budget");
    expect(body.answer).toContain("3,000");
  });

  it("does not claim an unrelated question is personal", async () => {
    const body = await ask("who won the world cup in 1994?");
    expect(body.route).toBe("general");
    expect(body.cited).toEqual([]);
    expect(body.recalled_ids).toEqual([]);
  });

  it("still answers a bare keyword", async () => {
    expect((await ask("laundry")).cited).toContain("laundry");
  });
});
