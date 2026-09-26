/**
 * Cortex engine: one long-running Node process for ingest, extraction, forgetting, the workflow
 * learner, the agent, voice, the change-stream live server and the eval harness.
 * Module map in apps/engine/README.md. FIXTURE_MODE=true serves the HTTP surface without Atlas.
 */
import "dotenv/config";
import { serve } from "@hono/node-server";
import { createApp } from "./api/index.js";
import { loadConfig } from "./config.js";
import { connect } from "./db.js";

async function main(): Promise<void> {
  const fixtureMode = process.env.FIXTURE_MODE === "true";
  const port = Number(process.env.ENGINE_PORT ?? 4000);
  const app = createApp({ fixtureMode });

  if (!fixtureMode) {
    const config = loadConfig();
    const { db } = await connect(config.ATLAS_URI, config.ATLAS_DB);
    const ping = await db.command({ ping: 1 });
    console.log(`engine: connected to ${config.ATLAS_DB} (ping ok=${ping.ok}); models ${config.EXTRACTION_MODEL} / ${config.REASONING_MODEL}`);
  } else {
    console.log("engine: FIXTURE_MODE, no database");
  }

  serve({ fetch: app.fetch, port }, () => console.log(`engine: http://localhost:${port}`));
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
