/**
 * Verifies the Atlas sandbox supports everything Cortex leans on: change streams, TTL indexes,
 * $graphLookup, and Atlas Vector Search. Works in a throwaway database and drops it afterwards.
 *
 *   pnpm atlas:check
 */
import "dotenv/config";
import { randomUUID } from "node:crypto";
import { MongoClient } from "mongodb";

const VECTOR_DIMS = 512;

interface Check {
  name: string;
  run: () => Promise<string>;
}

/** Only these locally authored messages are safe to print verbatim. */
class CheckFailure extends Error {}

async function main(): Promise<void> {
  const uri = process.env.ATLAS_URI;
  if (!uri) {
    console.error(
      "ATLAS_URI not set. Copy .env.example to .env and fill it in.",
    );
    process.exitCode = 2;
    return;
  }
  const client = new MongoClient(uri, {
    serverSelectionTimeoutMS: 15_000,
    connectTimeoutMS: 15_000,
  });
  // Never share a fixed scratch database with another run, or drop a user-selected database.
  const db = client.db(`_cortex_check_${randomUUID().replaceAll("-", "")}`);
  const results: Array<{ name: string; ok: boolean; detail: string }> = [];
  let connected = false;

  const checks: Check[] = [
    {
      name: "connection + server info",
      run: async () => {
        const info = await db.admin().command({ buildInfo: 1 });
        const hello = await db.admin().command({ hello: 1 });
        return `MongoDB ${info.version}, replica set ${Boolean(hello.setName)}, primary ${hello.isWritablePrimary}`;
      },
    },
    {
      name: "change stream delivers an insert",
      run: async () => {
        const col = db.collection("cs");
        await db.createCollection("cs");
        const stream = col.watch([], {
          fullDocument: "updateLookup",
          maxAwaitTimeMS: 1000,
        });
        try {
          // Initialize the cursor before inserting; a fixed delay can race a slow connection.
          await withTimeout(
            stream.tryNext(),
            10_000,
            "change stream initialization",
          );
          await col.insertOne({ hello: "cortex", at: new Date() });
          const ev = await withTimeout(
            stream.next(),
            10_000,
            "change stream event",
          );
          if (ev.operationType !== "insert")
            throw new CheckFailure(
              "change stream did not deliver the inserted document",
            );
          return `operationType=${ev.operationType}`;
        } finally {
          await stream.close();
        }
      },
    },
    {
      name: "TTL index accepted",
      run: async () => {
        const col = db.collection("ttl");
        await col.createIndex(
          { expires_at: 1 },
          { expireAfterSeconds: 0, name: "ttl_expires_at" },
        );
        const idx = (await col.indexes()).find(
          (i) => i.name === "ttl_expires_at",
        );
        if (!idx || idx.expireAfterSeconds !== 0)
          throw new CheckFailure("TTL index missing expireAfterSeconds");
        await col.insertOne({ expires_at: new Date(Date.now() - 60_000) });
        return "expireAfterSeconds=0 (TTL monitor runs about once a minute; deletion not awaited)";
      },
    },
    {
      name: "$graphLookup walks edges",
      run: async () => {
        const nodes = db.collection("nodes");
        const edges = db.collection("edges");
        await nodes.insertMany([
          { _id: "pref" },
          { _id: "event" },
          { _id: "capture" },
          { _id: "procedure" },
        ] as never[]);
        await edges.insertMany([
          { from: "pref", to: "event", type: "derived_from" },
          { from: "event", to: "capture", type: "evidence" },
          { from: "procedure", to: "pref", type: "uses" },
        ]);
        const out = await cursorArray(
          edges.aggregate([
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
          ]),
        );
        const reached = new Set<string>(
          (out[0]?.reach ?? []).map((e: { to: string }) => e.to),
        );
        if (!reached.has("capture"))
          throw new CheckFailure("graph traversal did not reach the capture");
        return `procedure -> ${[...reached].join(", ")}`;
      },
    },
    {
      name: "Atlas Vector Search index + $vectorSearch",
      run: async () => {
        const col = db.collection("vec");
        const vec = (seed: number) =>
          Array.from({ length: VECTOR_DIMS }, (_, i) =>
            Math.sin(seed * (i + 1)),
          );
        await col.insertMany([
          { _id: "a", text: "budget at most 2800", embedding: vec(1) },
          { _id: "b", text: "needs laundry", embedding: vec(2) },
          { _id: "c", text: "Priya's birthday dinner", embedding: vec(3) },
        ] as never[]);
        await col.createSearchIndex({
          name: "vec_idx",
          type: "vectorSearch",
          definition: {
            fields: [
              {
                type: "vector",
                path: "embedding",
                numDimensions: VECTOR_DIMS,
                similarity: "cosine",
              },
            ],
          },
        });
        const started = Date.now();
        for (;;) {
          const idx = (await cursorArray(col.listSearchIndexes())).find(
            (i) => i.name === "vec_idx",
          ) as { queryable?: boolean; status?: string } | undefined;
          if (idx?.queryable) break;
          if (idx?.status === "FAILED")
            throw new CheckFailure("vector index creation failed");
          if (Date.now() - started > 180_000)
            throw new CheckFailure("vector index not queryable after 180s");
          await new Promise((r) => setTimeout(r, 3000));
        }
        const hits = await cursorArray(
          col.aggregate([
            {
              $vectorSearch: {
                index: "vec_idx",
                path: "embedding",
                queryVector: vec(2),
                numCandidates: 10,
                limit: 1,
              },
            },
            { $project: { text: 1, score: { $meta: "vectorSearchScore" } } },
          ]),
        );
        if (hits[0]?._id !== "b")
          throw new CheckFailure(
            "vector search did not return the expected nearest neighbor",
          );
        return `top hit "${hits[0].text}" score ${hits[0].score.toFixed(3)} after ${((Date.now() - started) / 1000).toFixed(0)}s`;
      },
    },
  ];

  try {
    await client.connect();
    connected = true;
    for (const c of checks) {
      try {
        const detail = await c.run();
        results.push({ name: c.name, ok: true, detail });
        console.log(`PASS  ${c.name}\n      ${detail}`);
      } catch (err) {
        const detail = safeError(err);
        results.push({ name: c.name, ok: false, detail });
        console.log(`FAIL  ${c.name}\n      ${detail}`);
      }
    }
  } finally {
    try {
      if (connected) await db.dropDatabase();
    } finally {
      await client.close();
    }
  }

  const failed = results.filter((r) => !r.ok);
  console.log(
    failed.length
      ? `\n${failed.length} check(s) failed.`
      : "\nAll checks passed. Sandbox supports every Atlas feature Cortex uses.",
  );
  process.exitCode = failed.length ? 1 : 0;
}

async function withTimeout<T>(
  operation: Promise<T>,
  ms: number,
  what: string,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new CheckFailure(`timed out waiting for ${what}`)),
          ms,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

async function cursorArray<T>(cursor: {
  toArray(): Promise<T[]>;
  close(): Promise<void>;
}): Promise<T[]> {
  try {
    return await cursor.toArray();
  } finally {
    await cursor.close();
  }
}

function safeError(error: unknown): string {
  if (error instanceof CheckFailure) return error.message;
  // Driver errors can include connection strings. Report type/code, never their raw message.
  const name =
    error instanceof Error && /^[A-Za-z][A-Za-z0-9]*$/.test(error.name)
      ? error.name
      : "Atlas check error";
  const code =
    error && typeof error === "object" && "code" in error
      ? error.code
      : undefined;
  return `${name}${typeof code === "number" ? ` (code ${code})` : ""}`;
}

main().catch((err) => {
  console.error(safeError(err));
  process.exitCode = 1;
});
