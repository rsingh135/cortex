/** Live embedding smoke check. Requires only the Voyage variables, not Atlas/Claude. */
import { config as dotenv } from "dotenv";
import { fileURLToPath } from "node:url";
import { createVoyageEmbedder, EMBEDDING_DIMS } from "./embed.js";

dotenv({ path: fileURLToPath(new URL("../../../../.env", import.meta.url)), quiet: true });
dotenv({ quiet: true });

async function main() {
  const embedder = createVoyageEmbedder(process.env.VOYAGE_API_KEY, {
    ...(process.env.VOYAGE_BASE_URL ? { baseUrl: process.env.VOYAGE_BASE_URL } : {}),
    ...(process.env.VOYAGE_EMBEDDING_MODEL ? { model: process.env.VOYAGE_EMBEDDING_MODEL } : {}),
  });
  const result = await embedder.embed(["Cortex memory connection check"]);
  if (result[0]?.length !== EMBEDDING_DIMS) throw new Error("Unexpected embedding dimension");
  console.log(`Embedding API connected: ${result.length} vector, ${result[0].length} dimensions`);
}
main().catch(error => {
  console.error(error instanceof Error ? error.message : "Embedding check failed");
  process.exitCode = 1;
});
