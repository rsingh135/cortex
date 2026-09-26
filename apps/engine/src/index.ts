/**
 * Cortex engine: one long-running Node process that will hold ingest, extraction, forgetting,
 * the workflow learner, the agent, voice, the change-stream live server, and the eval harness.
 * Foundations pass: boots config and the database connection only.
 */
import "dotenv/config";
import { loadConfig } from "./config.js";
import { connect } from "./db.js";

async function main(): Promise<void> {
  const config = loadConfig();
  const { client, db } = await connect(config.ATLAS_URI, config.ATLAS_DB);
  const ping = await db.command({ ping: 1 });
  console.log(`engine: connected to ${config.ATLAS_DB} (ping ok=${ping.ok}); models ${config.EXTRACTION_MODEL} / ${config.REASONING_MODEL}`);
  await client.close();
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
