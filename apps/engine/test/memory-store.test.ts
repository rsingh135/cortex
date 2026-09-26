import { Binary, BSON, type Db, type Document, type MongoClient } from "mongodb";
import { describe, expect, it, vi } from "vitest";
import { emptyMemory, type MemoryData } from "../src/db/memory-data.js";
import { fixtureStore, mongoStore } from "../src/db/memory-store.js";

const clone = <T>(value: T): T =>
  BSON.deserialize(BSON.serialize({ value })).value as T;

/** Transactional driver double: writes become visible only on commit. */
function database(seed: Record<string, Document[]> = {}, retries = 0) {
  let committed = clone(seed);
  let pending = committed;
  const calls: { name: string; method: string; session: unknown }[] = [];
  const session = {
    withTransaction: vi.fn(async (action: () => Promise<unknown>) => {
      for (let attempt = 0; ; attempt++) {
        pending = clone(committed);
        const result = await action();
        if (attempt < retries) continue;
        committed = pending;
        return result;
      }
    }),
    endSession: vi.fn(async () => {}),
  };
  const db = {
    collection(name: string) {
      const rows = () => (pending[name] ??= []);
      const record = (method: string, options: { session: unknown }) => {
        calls.push({ name, method, session: options.session });
      };
      return {
        find(_query: unknown, options: { session: unknown }) {
          record("find", options);
          return { toArray: async () => clone(rows()) };
        },
        async findOne(query: Document, options: { session: unknown }) {
          record("findOne", options);
          return clone(rows().find((row) => row._id === query._id) ?? null);
        },
        async insertOne(document: Document, options: { session: unknown }) {
          record("insertOne", options);
          if (rows().some((row) => row._id === document._id))
            throw new Error("Duplicate key");
          rows().push(clone(document));
        },
        async insertMany(documents: Document[], options: { session: unknown }) {
          record("insertMany", options);
          rows().push(...clone(documents));
        },
        async replaceOne(query: Document, document: Document, options: { session: unknown }) {
          record("replaceOne", options);
          const index = rows().findIndex((row) => row._id === query._id);
          if (index < 0) throw new Error("Missing replacement document");
          rows()[index] = clone(document);
        },
        async updateOne(query: Document, update: Document, options: { session: unknown }) {
          record("updateOne", options);
          const previous = rows().find((row) => row._id === query._id);
          if (previous) Object.assign(previous, clone(update.$set));
          else rows().push({ ...query, ...clone(update.$setOnInsert), ...clone(update.$set) });
          const next = rows().find((row) => row._id === query._id)!;
          for (const [key, increment] of Object.entries(update.$inc ?? {}))
            next[key] = (next[key] ?? 0) + (increment as number);
        },
      };
    },
  };
  const client = { startSession: () => session };
  return {
    store: mongoStore(client as unknown as MongoClient, db as unknown as Db),
    rows: (name: string) => committed[name] ?? [],
    calls,
    session,
  };
}

function captureMemory(): MemoryData {
  const data = emptyMemory();
  data.captures.push({
    _id: "capture", episode_id: "episode", day: 0,
    ts: "2026-09-26T00:00:00.000Z", actor: "maya", app: "mockloft",
    url: "", title: "Listing", action: { type: "load" },
    page_text: "source text", phash: "0", extracted: false,
    belief_ids: [], l0_bytes: 3,
  });
  data.levels.push({
    _id: "level", capture_id: "capture", level: "L0",
    width: 1, height: 1, bytes: 3, data: new Binary(new Uint8Array([1, 2, 3])),
  });
  data.captureStates.push({
    _id: "capture-state", capture_id: "capture", condition: "cortex",
    alive_levels: ["L0"], ceiling: "L0", clarity: 1,
    recalls: 0, last_recall_day: 0,
  });
  data.beliefs.push({
    _id: "belief", triple: { s: "maya", p: "viewed", o: "listing" },
    text: "Maya viewed a listing", kind: "event", room: "Housing",
    source: "screen", inferred: false, pinned: false, c0: 1,
    evidence: ["capture"], created_day: 0, history: [],
    embedding: new Binary(new Uint8Array([4, 5])),
  });
  data.beliefStates.push({
    _id: "belief-state", belief_id: "belief", condition: "cortex",
    confidence: 1, recalls: 0, last_recall_day: 0,
    status: "active", superseded_by: null,
  });
  data.edges.push({
    _id: "edge", from: "belief", to: "capture", type: "evidence", weight: 1,
  });
  data.episodes.push({
    _id: "episode", day: 0, actor: "maya", app: "mockloft",
    started_at: "2026-09-26T00:00:00.000Z", capture_count: 1,
  });
  data.decisions.push({
    _id: "decision", episode_id: "episode", actor: "maya", listing_id: "listing",
    attrs: { price: 2000, neighborhood: "Brooklyn", train: "L", floor: 1,
      elevator: false, laundry: true, pets: true, walkup_floor: 1 },
    outcome: "messaged", capture_ids: ["capture"],
  });
  return data;
}

const writes = (db: ReturnType<typeof database>) => db.calls.filter(
  (call) => ["insertOne", "insertMany", "replaceOne", "updateOne"].includes(call.method),
);

describe("Mongo memory persistence", () => {
  it("persists an ingestion atomically and skips unchanged BSON documents", async () => {
    const db = database();
    await db.store.run(true, (data) => Object.assign(data, captureMemory()));
    expect(writes(db).map((call) => call.name)).toEqual([
      "clock", "beliefs", "belief_state", "captures", "capture_state",
      "image_levels", "edges", "episodes", "decisions",
    ]);
    expect(db.rows("image_levels")[0]!.data).toBeInstanceOf(Binary);
    expect(db.rows("clock")[0]!.write_revision).toBe(1);
    expect(db.calls.every((call) => call.session === db.session)).toBe(true);
    expect(db.session.withTransaction).toHaveBeenCalledWith(expect.any(Function), {
      readConcern: { level: "snapshot" }, writeConcern: { w: "majority" },
    });

    db.calls.length = 0;
    await db.store.run(true, (data) => {
      expect(data.episodes[0]!.capture_count).toBe(1);
      expect(data.decisions[0]!.outcome).toBe("messaged");
    });
    expect(writes(db).map((call) => call.name)).toEqual(["clock"]);
    expect(db.rows("clock")[0]!.write_revision).toBe(2);
  });

  it("replaces changed canonical documents, preserves absent rows, and detects binary changes", async () => {
    const db = database();
    await db.store.run(true, (data) => Object.assign(data, captureMemory()));
    db.calls.length = 0;
    await db.store.run(true, (data) => {
      delete data.captures[0]!.page_text;
      data.captures[0]!.extracted = true;
      data.episodes[0]!.capture_count++;
      (data.levels[0]!.data as Binary).value()[0] = 9;
      data.edges = [];
    });
    expect(db.rows("captures")[0]).not.toHaveProperty("page_text");
    expect(db.rows("episodes")[0]!.capture_count).toBe(2);
    expect(db.rows("image_levels")[0]!.data.value()[0]).toBe(9);
    expect(db.rows("edges")).toHaveLength(1);
    expect(writes(db).map((call) => call.name)).toEqual([
      "clock", "captures", "image_levels", "episodes",
    ]);
  });

  it("retains the stored daily-stat ID when recalculating a condition/day", async () => {
    const db = database({ daily_stats: [{
      _id: "original-id", condition: "cortex", day: 0,
      image_bytes: 0, belief_bytes: 0, captures_alive: 0,
      captures_forgotten: 0, beliefs_active: 0,
    }] });
    await db.store.run(true, (data) => {
      data.stats[0] = { ...data.stats[0]!, _id: "new-id", image_bytes: 7 };
    });
    expect(db.rows("daily_stats")).toEqual([
      expect.objectContaining({ _id: "original-id", image_bytes: 7 }),
    ]);
  });

  it("rebuilds mutable state on transaction retry without duplicate capture or recall inserts", async () => {
    const db = database({}, 1);
    const action = vi.fn((data: MemoryData) => {
      data.captures.push(...captureMemory().captures);
      data.recalls.push({
        _id: "recall", condition: "cortex", target_type: "capture",
        target_id: "capture", day: 0, by: "agent", reason: "test", dry_run: false,
      });
    });
    await db.store.run(true, action);
    expect(action).toHaveBeenCalledTimes(2);
    expect(db.rows("captures")).toHaveLength(1);
    expect(db.rows("recalls")).toHaveLength(1);
    expect(db.session.endSession).toHaveBeenCalledOnce();
  });

  it("makes no writes for read-only actions and rolls back a failed multi-collection write", async () => {
    const db = database();
    await db.store.run(false, (data) => Object.assign(data, captureMemory()));
    expect(writes(db)).toEqual([]);
    await expect(db.store.run(true, (data) => {
      Object.assign(data, captureMemory());
      data.episodes.push({ ...data.episodes[0]! });
    })).rejects.toThrow("Duplicate key");
    for (const name of ["clock", "captures", "beliefs", "image_levels", "episodes"])
      expect(db.rows(name)).toEqual([]);
    expect(db.session.endSession).toHaveBeenCalledTimes(2);
  });
});

describe("fixture memory isolation", () => {
  it("isolates inputs, read callbacks, returned writes, and Binary/Uint8Array buffers", async () => {
    const seed = captureMemory();
    seed.levels.push({ ...seed.levels[0]!, _id: "uint8", data: new Uint8Array([7]) });
    const store = fixtureStore(seed);
    (seed.levels[0]!.data as Binary).value()[0] = 99;
    const returned = await store.run(true, (data) => {
      expect(data.levels[0]!.data).toBeInstanceOf(Binary);
      expect((data.levels[0]!.data as Binary).value()[0]).toBe(1);
      data.episodes[0]!.capture_count++;
      return data;
    });
    (returned.levels[0]!.data as Binary).value()[0] = 99;
    (returned.levels[1]!.data as Uint8Array)[0] = 99;
    returned.episodes[0]!.capture_count = 99;
    await store.run(false, (data) => { data.episodes.length = 0; });
    await store.run(false, (data) => {
      expect(data.episodes[0]!.capture_count).toBe(2);
      expect((data.levels[0]!.data as Binary).value()[0]).toBe(1);
      expect(data.levels[1]!.data).toBeInstanceOf(Uint8Array);
      expect((data.levels[1]!.data as Uint8Array)[0]).toBe(7);
      expect(data.beliefs[0]!.embedding).toBeInstanceOf(Binary);
    });
  });
});
