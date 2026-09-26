/**
 * Verifies the Atlas sandbox supports everything Cortex leans on: change streams, TTL indexes,
 * $graphLookup, and Atlas Vector Search. Works in a throwaway database and drops it afterwards.
 *
 *   pnpm atlas:check
 */
import "dotenv/config";
import { MongoClient } from "mongodb";

const DB = "_cortex_check";
const VECTOR_DIMS = 512;

interface Check {
  name: string;
  run: () => Promise<string>;
}

async function main(): Promise<void> {
  const uri = process.env.ATLAS_URI;
  if (!uri) {
    console.error("ATLAS_URI not set. Copy .env.example to .env and fill it in.");
    process.exit(2);
  }
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(DB);
  const results: Array<{ name: string; ok: boolean; detail: string }> = [];

  const checks: Check[] = [
    {
      name: "connection + server info",
      run: async () => {
        const info = await db.admin().command({ buildInfo: 1 });
        const hello = await db.admin().command({ hello: 1 });
        const host = new URL(uri.replace("mongodb+srv://", "https://")).host;
        return `MongoDB ${info.version}, host ${host}, setName ${hello.setName ?? "?"}, primary ${hello.isWritablePrimary}`;
      },
    },
    {
      name: "change stream delivers an insert",
      run: async () => {
        const col = db.collection("cs");
        const stream = col.watch([], { fullDocument: "updateLookup" });
        const nextEvent = stream.next();
        await new Promise((r) => setTimeout(r, 300));
        await col.insertOne({ hello: "cortex", at: new Date() });
        const ev = await Promise.race([nextEvent, timeout<Awaited<typeof nextEvent>>(10_000, "change stream event")]);
        await stream.close();
        return `operationType=${ev.operationType}`;
      },
    },
    {
      name: "TTL index accepted",
      run: async () => {
        const col = db.collection("ttl");
        await col.createIndex({ expires_at: 1 }, { expireAfterSeconds: 0, name: "ttl_expires_at" });
        const idx = (await col.indexes()).find((i) => i.name === "ttl_expires_at");
        if (!idx || idx.expireAfterSeconds !== 0) throw new Error("TTL index missing expireAfterSeconds");
        await col.insertOne({ expires_at: new Date(Date.now() - 60_000) });
        return "expireAfterSeconds=0 (TTL monitor runs about once a minute; deletion not awaited)";
      },
    },
    {
      name: "$graphLookup walks edges",
      run: async () => {
        const nodes = db.collection("nodes");
        const edges = db.collection("edges");
        await nodes.insertMany([{ _id: "pref" }, { _id: "event" }, { _id: "capture" }, { _id: "procedure" }] as never[]);
        await edges.insertMany([
          { from: "pref", to: "event", type: "derived_from" },
          { from: "event", to: "capture", type: "evidence" },
          { from: "procedure", to: "pref", type: "uses" },
        ]);
        const out = await edges
          .aggregate([
            { $match: { from: "procedure" } },
            {
              $graphLookup: {
                from: "edges",
                startWith: "$to",
                connectFromField: "to",
                connectToField: "from",
                as: "reach",
                maxDepth: 5,
              },
            },
          ])
          .toArray();
        const reached = new Set<string>((out[0]?.reach ?? []).map((e: { to: string }) => e.to));
        if (!reached.has("capture")) throw new Error(`did not reach capture; reached ${JSON.stringify([...reached])}`);
        return `procedure -> ${[...reached].join(", ")}`;
      },
    },
    {
      name: "Atlas Vector Search index + $vectorSearch",
      run: async () => {
        const col = db.collection("vec");
        const vec = (seed: number) => Array.from({ length: VECTOR_DIMS }, (_, i) => Math.sin(seed * (i + 1)));
        await col.insertMany([
          { _id: "a", text: "budget at most 2800", embedding: vec(1) },
          { _id: "b", text: "needs laundry", embedding: vec(2) },
          { _id: "c", text: "Priya's birthday dinner", embedding: vec(3) },
        ] as never[]);
        await col.createSearchIndex({
          name: "vec_idx",
          type: "vectorSearch",
          definition: { fields: [{ type: "vector", path: "embedding", numDimensions: VECTOR_DIMS, similarity: "cosine" }] },
        });
        const started = Date.now();
        for (;;) {
          const idx = (await col.listSearchIndexes().toArray()).find((i) => i.name === "vec_idx") as { queryable?: boolean; status?: string } | undefined;
          if (idx?.queryable) break;
          if (Date.now() - started > 180_000) throw new Error(`index not queryable after 180s (status ${idx?.status})`);
          await new Promise((r) => setTimeout(r, 3000));
        }
        const hits = await col
          .aggregate([
            { $vectorSearch: { index: "vec_idx", path: "embedding", queryVector: vec(2), numCandidates: 10, limit: 1 } },
            { $project: { text: 1, score: { $meta: "vectorSearchScore" } } },
          ])
          .toArray();
        if (hits[0]?._id !== "b") throw new Error(`expected b, got ${JSON.stringify(hits)}`);
        return `top hit "${hits[0].text}" score ${hits[0].score.toFixed(3)} after ${((Date.now() - started) / 1000).toFixed(0)}s`;
      },
    },
  ];

  for (const c of checks) {
    try {
      const detail = await c.run();
      results.push({ name: c.name, ok: true, detail });
      console.log(`PASS  ${c.name}\n      ${detail}`);
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      results.push({ name: c.name, ok: false, detail });
      console.log(`FAIL  ${c.name}\n      ${detail}`);
    }
  }

  await db.dropDatabase();
  await client.close();
  const failed = results.filter((r) => !r.ok);
  console.log(failed.length ? `\n${failed.length} check(s) failed.` : "\nAll checks passed. Sandbox supports every Atlas feature Cortex uses.");
  process.exit(failed.length ? 1 : 0);
}

function timeout<T>(ms: number, what: string): Promise<T> {
  return new Promise((_, reject) => setTimeout(() => reject(new Error(`timed out waiting for ${what}`)), ms));
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
