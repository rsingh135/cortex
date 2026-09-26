/** Engine configuration from environment. Fails fast with a readable list of what is missing. */
import { z } from "zod";

const Env = z.object({
  ATLAS_URI: z.string().min(1),
  ATLAS_DB: z.string().min(1).default("cortex"),
  ANTHROPIC_API_KEY: z.string().min(1),
  VOYAGE_API_KEY: z.string().optional(),
  ELEVENLABS_API_KEY: z.string().optional(),
  ELEVENLABS_VOICE_ID: z.string().optional(),
  LANGSMITH_API_KEY: z.string().optional(),
  LANGSMITH_TRACING: z.string().optional(),
  LANGSMITH_PROJECT: z.string().default("cortex"),
  CORTEX_WRITE_TOKEN: z.string().min(1),
  ENGINE_PORT: z.coerce.number().int().positive().default(4000),
  EXTRACTION_MODEL: z.string().default("claude-sonnet-5"),
  REASONING_MODEL: z.string().default("claude-opus-5"),
});
export type Config = z.infer<typeof Env>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = Env.safeParse(env);
  if (!parsed.success) {
    const missing = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("\n  ");
    throw new Error(`Engine config invalid:\n  ${missing}\nCopy .env.example to .env and fill it in.`);
  }
  return parsed.data;
}
