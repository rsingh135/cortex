/** Engine configuration from environment. Fails fast with a readable list of what is missing. */
import { z } from "zod";

const Env = z.object({
  ATLAS_URI: z.string().min(1),
  ATLAS_DB: z.string().min(1).default("cortex"),
  ANTHROPIC_API_KEY: z.string().min(1),
  /** Required when the key is organization-scoped rather than workspace-scoped. */
  ANTHROPIC_WORKSPACE_ID: z.string().optional(),
  VOYAGE_API_KEY: z.string().optional(),
  VOYAGE_BASE_URL: z.url().optional(),
  VOYAGE_EMBEDDING_MODEL: z.string().min(1).optional(),
  ELEVENLABS_API_KEY: z.string().optional(),
  /** Premade "Sarah". Library voices (Emma included) need a paid ElevenLabs plan to use via the API. */
  ELEVENLABS_VOICE_ID: z.string().default("EXAVITQu4vr4xnSDxMaL"),
  LANGSMITH_API_KEY: z.string().optional(),
  LANGSMITH_TRACING: z.string().optional(),
  LANGSMITH_PROJECT: z.string().default("cortex"),
  CORTEX_WRITE_TOKEN: z.string().min(1),
  ENGINE_PORT: z.coerce.number().int().positive().default(4000),
  EXTRACTION_MODEL: z.string().default("claude-sonnet-5"),
  REASONING_MODEL: z.string().default("claude-opus-5"),
});
export type Config = z.infer<typeof Env>;

const MemoryEnv = Env.pick({
  ATLAS_URI: true,
  ATLAS_DB: true,
  ENGINE_PORT: true,
});
export type MemoryConfig = z.infer<typeof MemoryEnv>;

function parseEnv<T>(schema: z.ZodType<T>, env: NodeJS.ProcessEnv): T {
  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    const missing = parsed.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("\n  ");
    throw new Error(
      `Engine config invalid:\n  ${missing}\nCopy .env.example to .env and fill it in.`,
    );
  }
  return parsed.data;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  return parseEnv(Env, env);
}

/** Memory HTTP endpoints only need Atlas. AI and agent credentials are checked by their modules. */
export function loadMemoryConfig(
  env: NodeJS.ProcessEnv = process.env,
): MemoryConfig {
  return parseEnv(MemoryEnv, env);
}
