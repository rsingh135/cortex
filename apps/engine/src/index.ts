/**
 * Cortex engine: one long-running Node process for ingest, extraction, forgetting, the workflow
 * learner, the agent, voice, the change-stream live server and the eval harness.
 * Module map in apps/engine/README.md. FIXTURE_MODE=true serves the HTTP surface without Atlas.
 */
import { config as dotenv } from "dotenv";
import { fileURLToPath } from "node:url";
import type { Server } from "node:http";
import type { Db } from "mongodb";
dotenv({ path: fileURLToPath(new URL("../../../.env", import.meta.url)) });
dotenv();
import { serve } from "@hono/node-server";
import { createApp } from "./api/index.js";
import { loadMemoryConfig } from "./config.js";
import { fixtureStore, mongoStore } from "./db/memory-store.js";
import { connect } from "./db.js";
import { createLiveServer, type LiveServer } from "./live/server.js";
import { createAnthropicClient } from "./ai/client.js";
import { anthropicLlm } from "./ai/structured.js";
import { createExtractor } from "./extraction/extract.js";
import { createExtractionQueue } from "./extraction/queue.js";
import { createRouter } from "./router/index.js";
import { createAsker } from "./ask/index.js";
import { createAudioStore, createTts, PREMADE_VOICE } from "./voice/tts.js";

async function main(): Promise<void> {
  const fixtureMode = process.env.FIXTURE_MODE === "true";
  const port = Number(process.env.ENGINE_PORT ?? 4000);
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error("Invalid ENGINE_PORT");
  let memory = fixtureStore();
  let close = async () => {};
  let database: Db | undefined;
  let live: LiveServer | undefined;

  if (!fixtureMode) {
    const config = loadMemoryConfig();
    const { client, db } = await connect(config.ATLAS_URI, config.ATLAS_DB);
    database = db;
    memory = mongoStore(client, db);
    close = () => client.close();
    const ping = await db.command({ ping: 1 });
    console.log(`engine: connected to ${config.ATLAS_DB} (ping ok=${ping.ok})`);
  } else {
    console.log("engine: FIXTURE_MODE, no database");
    const fixture = memory;
    memory = {
      async run(write, action) {
        const result = await fixture.run(write, action);
        if (write) live?.refresh();
        return result;
      },
    };
  }

  // Model-backed pieces. FIXTURE_MODE never calls Claude; without ANTHROPIC_API_KEY the routes degrade.
  const client = fixtureMode ? null : createAnthropicClient();
  const llm = client ? anthropicLlm(client) : null;
  const extractionEnabled = process.env.EXTRACTION_ENABLED !== "false";
  const extractionModel = process.env.EXTRACTION_MODEL ?? "claude-sonnet-5";
  const reasoningModel = process.env.REASONING_MODEL ?? "claude-opus-5";
  const audio = createAudioStore();
  const router = createRouter(llm, extractionModel);
  const extraction =
    llm && extractionEnabled
      ? createExtractionQueue({
          store: memory,
          extractor: createExtractor(llm, extractionModel),
          concurrency: 2,
          onDone: (r) => console.log(`extraction: ${r.capture_id} +${r.inserted.length} beliefs, ${r.reinforced.length} reinforced`),
          onError: (id, err) => console.error(`extraction failed for ${id}: ${err instanceof Error ? err.message : String(err)}`),
        })
      : undefined;
  // Always built: without a model it answers extractively from memory, and it can still speak.
  const asker = createAsker({
    store: memory,
    router,
    model: reasoningModel,
    ...(llm ? { llm } : {}),
    tts: createTts({
      apiKey: process.env.ELEVENLABS_API_KEY,
      voiceId: process.env.ELEVENLABS_VOICE_ID ?? PREMADE_VOICE,
      store: audio,
    }),
  });
  console.log(
    `engine: model ${client ? "on" : "off"}${client ? ` (extraction ${extractionEnabled ? extractionModel : "disabled"}, answers ${reasoningModel})` : ""}`,
  );

  const app = createApp({
    fixtureMode,
    memory,
    router,
    audio,
    asker,
    ...(extraction ? { extraction } : {}),
  });
  const server = serve({ fetch: app.fetch, port }, () =>
    console.log(`engine: http://localhost:${port}`),
  );
  live = createLiveServer({
    server: server as Server,
    memory,
    ...(database ? { db: database } : {}),
  });
  await live.start();
  let stopping = false;
  const shutdown = () => {
    if (stopping) return;
    stopping = true;
    void (async () => {
      try {
        await live?.stop();
      } finally {
        await new Promise<void>((resolve) => server.close(() => resolve()));
        await close();
      }
    })().catch(() => {
      console.error("engine: shutdown failed");
      process.exitCode = 1;
    });
  };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
