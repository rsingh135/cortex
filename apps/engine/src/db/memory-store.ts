import type { MongoClient, Db } from "mongodb";
import { collections } from "../db.js";
import { emptyMemory, type MemoryData } from "./memory-data.js";

export interface MemoryStore {
  run<T>(write: boolean, action: (data: MemoryData) => T): Promise<T>;
}
export function fixtureStore(seed = emptyMemory()): MemoryStore {
  let data = structuredClone(seed);
  return {
    async run(write, action) {
      const copy = structuredClone(data);
      const result = action(copy);
      if (write) data = copy;
      return result;
    },
  };
}
/** Atlas transactions keep clock, ledgers and recall logs consistent, including concurrent requests. */
export function mongoStore(client: MongoClient, db: Db): MemoryStore {
  const c = collections(db);
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
            data.stats = await c.daily_stats.find({}, { session }).toArray();
            const result = action(data);
            if (write) {
              await c.clock.updateOne(
                { _id: "clock" },
                {
                  $set: { day: data.day },
                  $setOnInsert: { mode: "simulated" },
                },
                { upsert: true, session },
              );
              for (const s of data.beliefStates)
                await c.belief_state.replaceOne({ _id: s._id }, s, { session });
              for (const s of data.captureStates)
                await c.capture_state.replaceOne({ _id: s._id }, s, {
                  session,
                });
              for (const stat of data.stats)
                await c.daily_stats.replaceOne(
                  { condition: stat.condition, day: stat.day },
                  stat,
                  { upsert: true, session },
                );
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
