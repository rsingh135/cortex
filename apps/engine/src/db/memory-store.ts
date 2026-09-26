import {
  Binary,
  BSON,
  type ClientSession,
  type Collection,
  type Db,
  type Filter,
  type MongoClient,
  type OptionalUnlessRequiredId,
} from "mongodb";
import type { Clock } from "@cortex/schema";
import { collections } from "../db.js";
import { emptyMemory, type MemoryData } from "./memory-data.js";

export interface MemoryStore {
  run<T>(write: boolean, action: (data: MemoryData) => T): Promise<T>;
}

/** structuredClone does not retain BSON Binary's prototype. */
function cloneMemory(data: MemoryData): MemoryData {
  const copy = structuredClone(data);
  for (const field of ["levels", "beliefs", "procedures"] as const) {
    data[field].forEach((source, index) => {
      const target: { data?: unknown; embedding?: unknown } = copy[field][index]!;
      for (const key of ["data", "embedding"] as const) {
        if (key in source) {
          const value = (source as { data?: unknown; embedding?: unknown })[key];
          if (value instanceof Binary)
            target[key] = new Binary(
              Uint8Array.from(value.value()),
              value.sub_type,
            );
        }
      }
    });
  }
  return copy;
}

export function fixtureStore(seed = emptyMemory()): MemoryStore {
  let data = cloneMemory(seed);
  return {
    async run(write, action) {
      const copy = cloneMemory(data);
      const result = action(copy);
      if (write) data = cloneMemory(copy);
      return result;
    },
  };
}

function snapshot(documents: readonly { _id: string }[]) {
  return new Map(
    documents.map((document) => [document._id, BSON.serialize(document)]),
  );
}

/** Replacing changed documents also removes fields such as extracted page_text. */
async function persist<T extends { _id: string }>(
  collection: Collection<T>,
  documents: readonly T[],
  before: ReturnType<typeof snapshot>,
  session: ClientSession,
) {
  for (const document of documents) {
    const previous = before.get(document._id);
    if (!previous) {
      await collection.insertOne(document as OptionalUnlessRequiredId<T>, {
        session,
      });
    } else if (!Buffer.from(previous).equals(BSON.serialize(document))) {
      await collection.replaceOne(
        { _id: document._id } as Filter<T>,
        document,
        { session },
      );
    }
  }
}

/** Atlas transactions keep clock, ledgers and recall logs consistent, including concurrent requests. */
export function mongoStore(client: MongoClient, db: Db): MemoryStore {
  const c = collections(db);
  const clockCollection = c.clock as Collection<
    Clock & { write_revision?: number }
  >;
  return {
    async run<T>(write: boolean, action: (data: MemoryData) => T): Promise<T> {
      const session = client.startSession();
      try {
        return (await session.withTransaction(
          async () => {
            const data = emptyMemory();
            const clock = await c.clock.findOne({ _id: "clock" }, { session });
            if (clock?.mode === "realtime")
              throw new Error(
                "Memory ledger operations require simulated clock mode",
              );
            data.day = clock?.day ?? 0;
            data.beliefs = await c.beliefs.find({}, { session }).toArray();
            data.beliefStates = await c.belief_state
              .find({}, { session })
              .toArray();
            data.captures = await c.captures.find({}, { session }).toArray();
            data.captureStates = await c.capture_state
              .find({}, { session })
              .toArray();
            data.levels = await c.image_levels.find({}, { session }).toArray();
            data.procedures = await c.procedures
              .find({}, { session })
              .toArray();
            data.edges = await c.edges.find({}, { session }).toArray();
            data.episodes = await c.episodes.find({}, { session }).toArray();
            data.decisions = await c.decisions.find({}, { session }).toArray();
            data.stats = await c.daily_stats.find({}, { session }).toArray();
            const before = write
              ? {
                  beliefs: snapshot(data.beliefs),
                  beliefStates: snapshot(data.beliefStates),
                  captures: snapshot(data.captures),
                  captureStates: snapshot(data.captureStates),
                  levels: snapshot(data.levels),
                  procedures: snapshot(data.procedures),
                  edges: snapshot(data.edges),
                  episodes: snapshot(data.episodes),
                  decisions: snapshot(data.decisions),
                  stats: snapshot(data.stats),
                }
              : undefined;
            const statIds = new Map(
              data.stats.map((stat) => [
                `${stat.condition}:${stat.day}`,
                stat._id,
              ]),
            );
            const result = action(data);
            if (before) {
              // A revision increment forces a write conflict even on the same day,
              // so concurrent ingestions reload the ledger before retrying.
              await clockCollection.updateOne(
                { _id: "clock" },
                {
                  $set: { day: data.day },
                  $setOnInsert: { mode: "simulated" },
                  $inc: { write_revision: 1 },
                },
                { upsert: true, session },
              );
              await persist(c.beliefs, data.beliefs, before.beliefs, session);
              await persist(
                c.belief_state, data.beliefStates, before.beliefStates, session,
              );
              await persist(c.captures, data.captures, before.captures, session);
              await persist(
                c.capture_state, data.captureStates, before.captureStates, session,
              );
              await persist(c.image_levels, data.levels, before.levels, session);
              await persist(
                c.procedures, data.procedures, before.procedures, session,
              );
              await persist(c.edges, data.edges, before.edges, session);
              await persist(c.episodes, data.episodes, before.episodes, session);
              await persist(
                c.decisions, data.decisions, before.decisions, session,
              );
              for (const stat of data.stats) {
                const previousId = statIds.get(`${stat.condition}:${stat.day}`);
                if (previousId) stat._id = previousId;
              }
              await persist(c.daily_stats, data.stats, before.stats, session);
              if (data.recalls.length)
                await c.recalls.insertMany(data.recalls, { session });
            }
            return result;
          },
          {
            readConcern: { level: "snapshot" },
            writeConcern: { w: "majority" },
          },
        )) as T;
      } finally {
        await session.endSession();
      }
    },
  };
}
