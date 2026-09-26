/** Live memory integration check; creates and removes only a uniquely named test database. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { config as dotenv } from "dotenv";
import { Binary, MongoClient } from "mongodb";
import sharp from "sharp";
import {
  CONDITIONS,
  LEVELS,
  Snapshot,
  type Belief,
  type Capture,
  type CaptureState,
  type BeliefState,
} from "@cortex/schema";
import { collections } from "../db.js";
import { createApp } from "../api/app.js";
import { mongoStore } from "./memory-store.js";

dotenv({
  path: fileURLToPath(new URL("../../../../.env", import.meta.url)),
  quiet: true,
});
dotenv({ quiet: true });

async function main() {
  if (!process.env.ATLAS_URI)
    throw new Error("ATLAS_URI is required for memory:check");
  const client = new MongoClient(process.env.ATLAS_URI, {
    serverSelectionTimeoutMS: 15_000,
  });
  const db = client.db(
    `_cortex_memory_check_${randomUUID().replaceAll("-", "")}`,
  );
  let created = false;
  try {
    await client.connect();
    await db.createCollection("clock");
    created = true;
    const c = collections(db);
    const belief: Belief = {
      _id: "belief",
      triple: { s: "maya", p: "budget_max", o: "3000" },
      text: "Maya's budget is 3000",
      kind: "preference",
      room: "Housing",
      source: "screen",
      inferred: false,
      pinned: false,
      c0: 0.8,
      evidence: ["capture"],
      created_day: 0,
      history: [],
      embedding: new Binary(new Uint8Array(512)),
    };
    const bytes = await sharp({
      create: { width: 8, height: 8, channels: 3, background: "#4477aa" },
    })
      .webp()
      .toBuffer();
    const capture: Capture = {
      _id: "capture",
      episode_id: "episode",
      day: 0,
      ts: new Date().toISOString(),
      actor: "maya",
      app: "mockloft",
      url: "",
      title: "Test listing",
      action: { type: "load" },
      phash: "0",
      extracted: true,
      belief_ids: [belief._id],
      l0_bytes: bytes.length,
      page_text: "raw text omitted from snapshot",
    };
    await c.clock.insertOne({ _id: "clock", day: 0, mode: "simulated" });
    await c.beliefs.insertOne(belief);
    await c.captures.insertOne(capture);
    await c.image_levels.insertMany(
      LEVELS.map((level) => ({
        _id: level,
        capture_id: capture._id,
        level,
        width: 8,
        height: 8,
        bytes: bytes.length,
        data: new Binary(bytes),
      })),
    );
    await c.capture_state.insertMany(
      CONDITIONS.map(
        (condition): CaptureState => ({
          _id: condition,
          condition,
          capture_id: capture._id,
          alive_levels: [...LEVELS],
          ceiling: "L0",
          clarity: 1,
          recalls: 0,
          last_recall_day: 0,
        }),
      ),
    );
    await c.belief_state.insertMany(
      CONDITIONS.map(
        (condition): BeliefState => ({
          _id: condition,
          condition,
          belief_id: belief._id,
          confidence: belief.c0,
          recalls: 0,
          last_recall_day: 0,
          status: "active",
          superseded_by: null,
        }),
      ),
    );
    await c.daily_stats.insertOne({
      _id: "existing-stat-id",
      condition: "cortex",
      day: 2,
      image_bytes: 0,
      belief_bytes: 0,
      captures_alive: 0,
      captures_forgotten: 0,
      beliefs_active: 0,
    });
    const store = mongoStore(client, db);
    const app = createApp({ fixtureMode: false, memory: store });
    const post = (path: string, body: unknown) =>
      app.request(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    const recall = {
      query: "maya",
      by: "agent",
      reason: "integration check",
      with_images: true,
    };
    assert.equal((await post("/clock/advance", { to_day: 2 })).status, 200);
    assert.equal(
      (await c.daily_stats.findOne({ condition: "cortex", day: 2 }))?._id,
      "existing-stat-id",
    );
    console.log(
      "PASS clock sweep, per-condition states, and existing statistics ID",
    );

    const before = await c.belief_state.findOne({ _id: "cortex" });
    assert.equal(
      (await post("/recall", { ...recall, dry_run: true })).status,
      200,
    );
    assert.deepEqual(await c.belief_state.findOne({ _id: "cortex" }), before);
    assert.equal(await c.recalls.countDocuments(), 0);
    console.log("PASS dry-run recall does not change memory or logs");

    const responses = await Promise.all([
      post("/recall", recall),
      post("/recall", recall),
    ]);
    responses.forEach((response) => assert.equal(response.status, 200));
    assert.equal((await c.belief_state.findOne({ _id: "cortex" }))?.recalls, 2);
    assert.equal(
      (await c.capture_state.findOne({ _id: "cortex" }))?.recalls,
      2,
    );
    assert.equal(await c.recalls.countDocuments(), 4);
    console.log(
      "PASS concurrent recalls persist exactly once through Atlas transactions",
    );

    const image = await app.request("/image/capture");
    assert.equal(image.status, 200);
    assert.equal(image.headers.get("Content-Type"), "image/webp");
    assert.deepEqual(Buffer.from(await image.arrayBuffer()), bytes);
    const snapshot = Snapshot.parse(
      await (await app.request("/snapshot")).json(),
    );
    assert.equal(snapshot.payload.beliefs.length, 1);
    assert.equal("embedding" in snapshot.payload.beliefs[0]!, false);
    assert.equal("page_text" in snapshot.payload.captures[0]!, false);
    console.log("PASS Binary-backed image serving and sanitized snapshot");

    await assert.rejects(
      store.run(true, (data) => {
        data.day = 999;
        throw new Error("intentional rollback");
      }),
      /intentional rollback/,
    );
    assert.equal((await c.clock.findOne({ _id: "clock" }))?.day, 2);
    assert.equal((await post("/clock/advance", { to_day: 1 })).status, 400);
    assert.equal((await c.clock.findOne({ _id: "clock" }))?.day, 2);
    assert.equal((await post("/clock/advance", { to_day: 1000 })).status, 200);
    assert.equal((await app.request("/image/capture")).status, 404);
    assert.equal(
      (await app.request("/image/capture?condition=keep_all")).status,
      200,
    );
    assert.equal(await c.image_levels.countDocuments(), 4);
    console.log(
      "PASS transaction rollback and forgetting with canonical images preserved",
    );
  } finally {
    try {
      if (created) {
        await db.dropDatabase();
        console.log("Temporary memory-check database removed");
      }
    } finally {
      await client.close();
    }
  }
}

main().catch((error) => {
  // Deliberately omit driver messages, which may contain connection details.
  console.error(
    `Memory check failed (${error instanceof Error ? error.name : "unknown error"})`,
  );
  process.exitCode = 1;
});
