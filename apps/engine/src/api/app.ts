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
}

const ConditionQuery = z.object({ condition: Condition.default("cortex") });

export function createApp(opts: AppOptions): Hono {
  const app = new Hono();
  const intake = opts.memory ? createIntake(opts.memory) : undefined;
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
    if (intake)
      return c.json(
        await intake.ingest(Buffer.from(await image.arrayBuffer()), meta.data),
      );
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
    return c.json({ error: "not implemented", route: "POST /ask" }, 501);
  });

  app.get("/map", (c) => {
    const q = validateQuery(c, ConditionQuery);
    if (!q.ok) return q.response;
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
