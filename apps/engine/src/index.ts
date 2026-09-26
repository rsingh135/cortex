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
import {
  createAsker,
  createAudioStore,
  createClaudeAnswerer,
  createElevenLabsSpeaker,
  type Speaker,
} from "./ask/index.js";
import Anthropic from "@anthropic-ai/sdk";

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

  // Both credentials are optional: without them /ask still answers extractively from memory,
  // which is what the eval harness and the offline demo rely on.
  const audio = createAudioStore();
  const anthropicKey = process.env.ANTHROPIC_API_KEY?.trim();
  // An organization-scoped key rejects every request without this header.
  const workspaceId = process.env.ANTHROPIC_WORKSPACE_ID?.trim();
  const elevenKey = process.env.ELEVENLABS_API_KEY?.trim();
  let speaker: Speaker | undefined;
  if (elevenKey) {
    speaker = createElevenLabsSpeaker(elevenKey, {
      voiceId: process.env.ELEVENLABS_VOICE_ID?.trim() || "EXAVITQu4vr4xnSDxMaL",
      store: audio,
    });
  }
  const asker = createAsker({
    store: memory,
    ...(anthropicKey
      ? {
          answerer: createClaudeAnswerer(
            new Anthropic({
              apiKey: anthropicKey,
              ...(workspaceId
                ? { defaultHeaders: { "anthropic-workspace-id": workspaceId } }
                : {}),
            }),
            process.env.REASONING_MODEL?.trim() || "claude-opus-5",
          ),
        }
      : {}),
    ...(speaker ? { speaker } : {}),
  });
  console.log(
    `engine: /ask uses ${anthropicKey ? "claude" : "extractive"} answers${speaker ? " with speech" : ""}`,
  );

  const app = createApp({ fixtureMode, memory, asker, audio });
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
