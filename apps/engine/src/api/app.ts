/**
 * HTTP surface of the engine. Every route from docs/contracts.md, validated with @cortex/schema/api.
 * Handlers return 501 until their module lands; wiring them is the memory track's job.
 */
import { Binary } from "mongodb";
import { cors } from "hono/cors";
import { bodyLimit } from "hono/body-limit";
import { createIntake } from "../ingest/intake.js";
import { startEpisode, endEpisode } from "../ingest/episodes.js";
import { servedLevel } from "@cortex/schema";
import type { MemoryStore } from "../db/memory-store.js";
import { advanceMemory } from "../forgetting/sweep.js";
import { recallMemory } from "../recall/search.js";
import { snapshot } from "../live/snapshot.js";
import { buildAgentMap } from "../map/index.js";
import type { Router } from "../router/index.js";
import { createAsker, type Asker } from "../ask/index.js";
import type { ExtractionQueue } from "../extraction/queue.js";
import type { AudioStore } from "../voice/tts.js";
import { Hono } from "hono";
import { z } from "zod";
import {
  AdvanceClockRequest,
  AgentRunRequest,
  AskRequest,
  Condition,
  IngestCaptureMeta,
  LearnRequest,
  RecallRequest,
  RouteRequest,
  StartEpisodeRequest,
  VoiceRequest,
} from "@cortex/schema";
import { validateJson, validateQuery } from "./validate.js";

export interface AppOptions {
  fixtureMode: boolean;
  memory?: MemoryStore;
  now?: () => string;
  /** Model-backed pieces; absent in FIXTURE_MODE or without ANTHROPIC_API_KEY. */
  router?: Router;
  asker?: Asker;
  /** Background belief extraction; captures are enqueued right after they are stored. */
  extraction?: ExtractionQueue;
  audio?: AudioStore;
}

const ConditionQuery = z.object({ condition: Condition.default("cortex") });

export function createApp(opts: AppOptions): Hono {
  const app = new Hono();
  const intake = opts.memory ? createIntake(opts.memory) : undefined;
  // Falls back to the deterministic asker, so /ask answers from memory even with no model key.
  const asker =
    opts.asker ?? (opts.memory ? createAsker({ store: opts.memory }) : undefined);
  app.use("*", cors());
  app.onError((error, c) => {
    if (error instanceof RangeError || error instanceof SyntaxError)
      return c.json({ error: error.message }, 400);
    console.error(error);
    return c.json({ error: "Memory operation failed" }, 500);
  });
  const now = opts.now ?? (() => new Date().toISOString());
  app.get("/health", (c) =>
    c.json({ ok: true, fixture_mode: opts.fixtureMode, ts: now() }),
  );

  app.post("/episodes", async (c) => {
    const v = await validateJson(c, StartEpisodeRequest);
    if (!v.ok) return v.response;
    if (opts.memory)
      return c.json(
        await opts.memory.run(true, (d) => startEpisode(d, v.data, now())),
      );
    return c.json({ error: "not implemented", route: "POST /episodes" }, 501);
  });
  app.post("/episodes/:id/end", async (c) => {
    if (!opts.memory)
      return c.json(
        { error: "not implemented", route: "POST /episodes/:id/end" },
        501,
      );
    const result = await opts.memory.run(true, (d) =>
      endEpisode(d, c.req.param("id"), now()),
    );
    return result
      ? c.json(result)
      : c.json({ error: "Episode not found" }, 404);
  });

  app.use(
    "/ingest/capture",
    bodyLimit({
      maxSize: 11 * 1024 * 1024,
      onError: (c) => c.json({ error: "Capture request exceeds 11 MiB" }, 413),
    }),
  );

  app.post("/ingest/capture", async (c) => {
    const form = await c.req.formData().catch(() => null);
    const metaRaw = form?.get("meta");
    if (typeof metaRaw !== "string")
      return c.json(
        { error: "multipart with `meta` JSON and `image` file required" },
        400,
      );
    const meta = IngestCaptureMeta.safeParse(JSON.parse(metaRaw));
    if (!meta.success)
      return c.json(
        { error: "validation failed", issues: meta.error.issues },
        400,
      );
    const image = form?.get("image");
    if (!(image instanceof File))
      return c.json({ error: "An image file is required" }, 400);
    if (image.size > 10 * 1024 * 1024)
      return c.json({ error: "Image exceeds 10 MiB" }, 413);
    if (intake) {
      const result = await intake.ingest(
        Buffer.from(await image.arrayBuffer()),
        meta.data,
      );
      if (result.stored) opts.extraction?.enqueue(result.capture_id);
      return c.json(result);
    }
    return c.json(
      { error: "not implemented", route: "POST /ingest/capture" },
      501,
    );
  });

  app.post("/clock/advance", async (c) => {
    const v = await validateJson(c, AdvanceClockRequest);
    if (!v.ok) return v.response;
    if (opts.memory)
      return c.json(
        await opts.memory.run(true, (d) =>
          advanceMemory(d, v.data.to_day, v.data.conditions),
        ),
      );
    return c.json(
      { error: "not implemented", route: "POST /clock/advance" },
      501,
    );
  });

  app.post("/recall", async (c) => {
    const v = await validateJson(c, RecallRequest);
    if (!v.ok) return v.response;
    if (opts.memory)
      return c.json(
        await opts.memory.run(!v.data.dry_run, (d) => recallMemory(d, v.data)),
      );
    return c.json({ error: "not implemented", route: "POST /recall" }, 501);
  });

  app.get("/image/:capture_id", async (c) => {
    const q = validateQuery(c, ConditionQuery);
    if (!q.ok) return q.response;
    if (opts.memory) {
      const image = await opts.memory.run(false, (d) => {
        const state = d.captureStates.find(
          (s) =>
            s.condition === q.data.condition &&
            s.capture_id === c.req.param("capture_id"),
        );
        const level = state
          ? servedLevel(state.alive_levels, state.clarity)
          : null;
        return d.levels.find(
          (l) =>
            l.capture_id === c.req.param("capture_id") && l.level === level,
        );
      });
      if (!image) return c.notFound();
      const bytes =
        image.data instanceof Binary ? image.data.value() : image.data;
      if (!(bytes instanceof Uint8Array))
        throw new Error("Invalid stored image");
      return c.body(new Uint8Array(bytes), 200, {
        "Content-Type": "image/webp",
        "Cache-Control": "no-store",
      });
    }
    return c.json(
      { error: "not implemented", route: "GET /image/:capture_id" },
      501,
    );
  });

  app.post("/learn", async (c) => {
    const v = await validateJson(c, LearnRequest);
    if (!v.ok) return v.response;
    return c.json({ error: "not implemented", route: "POST /learn" }, 501);
  });

  app.post("/voice", async (c) => {
    const v = await validateJson(c, VoiceRequest);
    if (!v.ok) return v.response;
    return c.json({ error: "not implemented", route: "POST /voice" }, 501);
  });

  app.post("/route", async (c) => {
    const v = await validateJson(c, RouteRequest);
    if (!v.ok) return v.response;
    if (opts.router && opts.memory) {
      const procedures = await opts.memory.run(false, (d) =>
        d.procedures.map((p) => ({ _id: p._id, name: p.name, description: p.description })),
      );
      return c.json(await opts.router.route(v.data.text, procedures));
    }
    return c.json({ error: "not implemented", route: "POST /route" }, 501);
  });

  app.post("/agent/run", async (c) => {
    const v = await validateJson(c, AgentRunRequest);
    if (!v.ok) return v.response;
    return c.json({ error: "not implemented", route: "POST /agent/run" }, 501);
  });
  app.post("/agent/drafts/:draft_id/approve", (c) =>
    c.json(
      {
        error: "not implemented",
        route: "POST /agent/drafts/:draft_id/approve",
      },
      501,
    ),
  );

  app.post("/ask", async (c) => {
    const v = await validateJson(c, AskRequest);
    if (!v.ok) return v.response;
    if (asker) return c.json(await asker.ask(v.data));
    return c.json({ error: "not implemented", route: "POST /ask" }, 501);
  });

  app.get("/audio/:id", (c) => {
    const bytes = opts.audio?.get(c.req.param("id"));
    if (!bytes) return c.notFound();
    return c.body(new Uint8Array(bytes), 200, {
      "Content-Type": "audio/mpeg",
      "Cache-Control": "private, max-age=3600",
    });
  });

  app.get("/map", async (c) => {
    const q = validateQuery(c, ConditionQuery);
    if (!q.ok) return q.response;
    if (opts.memory)
      return c.json(
        await opts.memory.run(false, (d) => buildAgentMap(d, q.data.condition)),
      );
    return c.json({ error: "not implemented", route: "GET /map" }, 501);
  });

  app.get("/snapshot", async (c) => {
    const q = validateQuery(c, ConditionQuery);
    if (!q.ok) return q.response;
    if (opts.memory)
      return c.json(
        await opts.memory.run(false, (d) => snapshot(d, q.data.condition)),
      );
    if (!opts.fixtureMode)
      return c.json({ error: "not implemented", route: "GET /snapshot" }, 501);
    return c.json({
      id: "snapshot-empty",
      type: "snapshot",
      day: 0,
      ts: now(),
      condition: q.data.condition,
      payload: { beliefs: [], captures: [], procedures: [], edges: [] },
    });
  });

  app.get("/stats", async (c) => {
    const q = validateQuery(c, ConditionQuery);
    if (!q.ok) return q.response;
    if (opts.memory)
      return c.json(
        await opts.memory.run(false, (d) => ({
          rows: d.stats
            .filter((s) => s.condition === q.data.condition)
            .sort((a, b) => a.day - b.day)
            .map((s) => ({
              condition: s.condition,
              day: s.day,
              image_bytes: s.image_bytes,
              belief_bytes: s.belief_bytes,
              accuracy_weighted: s.accuracy?.weighted ?? null,
            })),
        })),
      );
    return c.json({ error: "not implemented", route: "GET /stats" }, 501);
  });

  return app;
}
