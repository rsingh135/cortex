/**
 * HTTP surface of the engine. Every route from docs/contracts.md, validated with @cortex/schema/api.
 * Handlers return 501 until their module lands; wiring them is the memory track's job.
 */
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
  now?: () => string;
}

const ConditionQuery = z.object({ condition: Condition.default("cortex") });

export function createApp(opts: AppOptions): Hono {
  const app = new Hono();
  const now = opts.now ?? (() => new Date().toISOString());
  app.get("/health", (c) => c.json({ ok: true, fixture_mode: opts.fixtureMode, ts: now() }));

  app.post("/episodes", async (c) => {
    const v = await validateJson(c, StartEpisodeRequest);
    if (!v.ok) return v.response;
    return c.json({ error: "not implemented", route: "POST /episodes" }, 501);
  });
  app.post("/episodes/:id/end", (c) => c.json({ error: "not implemented", route: "POST /episodes/:id/end" }, 501));

  app.post("/ingest/capture", async (c) => {
    const form = await c.req.formData().catch(() => null);
    const metaRaw = form?.get("meta");
    if (typeof metaRaw !== "string") return c.json({ error: "multipart with `meta` JSON and `image` file required" }, 400);
    const meta = IngestCaptureMeta.safeParse(JSON.parse(metaRaw));
    if (!meta.success) return c.json({ error: "validation failed", issues: meta.error.issues }, 400);
    return c.json({ error: "not implemented", route: "POST /ingest/capture" }, 501);
  });

  app.post("/clock/advance", async (c) => {
    const v = await validateJson(c, AdvanceClockRequest);
    if (!v.ok) return v.response;
    return c.json({ error: "not implemented", route: "POST /clock/advance" }, 501);
  });

  app.post("/recall", async (c) => {
    const v = await validateJson(c, RecallRequest);
    if (!v.ok) return v.response;
    return c.json({ error: "not implemented", route: "POST /recall" }, 501);
  });

  app.get("/image/:capture_id", (c) => {
    const q = validateQuery(c, ConditionQuery);
    if (!q.ok) return q.response;
    return c.json({ error: "not implemented", route: "GET /image/:capture_id" }, 501);
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
  app.post("/agent/drafts/:draft_id/approve", (c) => c.json({ error: "not implemented", route: "POST /agent/drafts/:draft_id/approve" }, 501));

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

  app.get("/snapshot", (c) => {
    const q = validateQuery(c, ConditionQuery);
    if (!q.ok) return q.response;
    if (!opts.fixtureMode) return c.json({ error: "not implemented", route: "GET /snapshot" }, 501);
    return c.json({
      id: "snapshot-empty",
      type: "snapshot",
      day: 0,
      ts: now(),
      condition: q.data.condition,
      payload: { beliefs: [], captures: [], procedures: [], edges: [] },
    });
  });

  app.get("/stats", (c) => {
    const q = validateQuery(c, ConditionQuery);
    if (!q.ok) return q.response;
    return c.json({ error: "not implemented", route: "GET /stats" }, 501);
  });

  return app;
}
