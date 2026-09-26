/**
 * Cortex engine: one long-running Node process for ingest, extraction, forgetting, the workflow
 * learner, the agent, voice, the change-stream live server and the eval harness.
 * Module map in apps/engine/README.md. FIXTURE_MODE=true serves the HTTP surface without Atlas.
 */
import { config as dotenv } from "dotenv";
import { fileURLToPath } from "node:url";
dotenv({ path: fileURLToPath(new URL("../../../.env", import.meta.url)) });
dotenv();
import { serve } from "@hono/node-server";
import { createApp } from "./api/index.js";
import { loadMemoryConfig } from "./config.js";
import { fixtureStore, mongoStore } from "./db/memory-store.js";
import { connect } from "./db.js";

async function main(): Promise<void> {
  const fixtureMode = process.env.FIXTURE_MODE === "true";
  const port = Number(process.env.ENGINE_PORT ?? 4000);
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error("Invalid ENGINE_PORT");
  let memory = fixtureStore();
  let close = async () => {};

  if (!fixtureMode) {
    const config = loadMemoryConfig();
    const { client, db } = await connect(config.ATLAS_URI, config.ATLAS_DB);
    memory = mongoStore(client, db);
    close = () => client.close();
    const ping = await db.command({ ping: 1 });
    console.log(
      `engine: connected to ${config.ATLAS_DB} (ping ok=${ping.ok})`,
    );
  } else {
    console.log("engine: FIXTURE_MODE, no database");
  }

  const app = createApp({ fixtureMode, memory });
  const server = serve({ fetch: app.fetch, port }, () =>
    console.log(`engine: http://localhost:${port}`),
  );
  const shutdown = () =>
    server.close(() => {
      void close();
    });
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
