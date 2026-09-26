# Contracts

Frozen interfaces every track builds against. Types live in `packages/schema/src/api.ts` and `events.ts`; this page is the human index. Change the schema first, then this page.

## Conventions

- Every `_id` is a ULID string. Never `ObjectId`.
- Every memory document carries `day` (simulated day, integer). Timestamps are ISO strings.
- Canonical documents (`captures`, `image_levels`, `beliefs`, `edges`, `procedures`, `decisions`, `episodes`) are written once. Per-condition state lives in `capture_state` and `belief_state`, keyed by `(condition, capture_id | belief_id)`. See `docs/spec.md` > Data model.
- Enums are closed. Extraction output that fails schema validation is rejected and retried once, then dropped.
- Mock-world write endpoints require the header `x-cortex-write-token: $CORTEX_WRITE_TOKEN`. Reads are open.

## Engine HTTP (apps/engine, port 4000)

| Method | Path | Request | Response | Notes |
| --- | --- | --- | --- | --- |
| POST | `/episodes` | `StartEpisodeRequest` | `StartEpisodeResponse` | Playwright scripts and the agent open one per run |
| POST | `/episodes/:id/end` | none | `EndEpisodeResponse` | Writes the summary belief; flags a workflow candidate when a similar episode exists |
| POST | `/ingest/capture` | multipart `image` (PNG or WebP) + `meta` (JSON `IngestCaptureMeta`) | `IngestCaptureResponse` | Builds the L0..L3 ladder, dedupes by perceptual hash, queues extraction. Returns `stored: false` on a near-duplicate |
| POST | `/clock/advance` | `AdvanceClockRequest` | `AdvanceClockResponse` | Runs the forgetting sweep per condition; emits `clock.advanced` |
| POST | `/recall` | `RecallRequest` | `RecallResponse` | `dry_run: true` for evaluation checkpoints: no log, no clock reset, no clarity restore |
| GET | `/image/:capture_id?condition=cortex` | none | `image/webp` | Served level per the parameters table; 404 when every level is gone |
| POST | `/learn` | `LearnRequest` | `LearnResponse` | Two or more episode ids; returns the procedure, surviving rules, dropped rules with contradictions |
| POST | `/voice` | `VoiceRequest` or multipart `audio` | `VoiceResponse` | Transcript in, beliefs + cracked procedures out |
| POST | `/route` | `RouteRequest` | `RouteResponse` | general / personal / workflow |
| POST | `/agent/run` | `AgentRunRequest` | `AgentRunResponse` | Runs the procedure in Playwright; returns decisions with belief citations and message drafts awaiting approval |
| POST | `/agent/drafts/:draft_id/approve` | none | `ApproveDraftResponse` | Presenter approval sends the landlord message |
| POST | `/ask` | `AskRequest` | `AskResponse` | Mascot and palace chat. Routes, recalls, answers with belief citations; optional ElevenLabs audio. Cited beliefs pulse in the palace |
| GET | `/map?condition=cortex` | none | `MapResponse` | The agent's 2D map, about 500 tokens |
| GET | `/snapshot?condition=cortex` | none | `WsEvent` of type `snapshot` | Palace calls on connect and reconnect |
| GET | `/stats?condition=cortex` | none | `StatsResponse` | Daily bytes and accuracy rows for the chart |

## WebSocket (apps/engine, `/ws`)

Envelope: `{ id, type, day, ts, condition, payload }`. Types and payloads in `packages/schema/src/events.ts`:

`capture.created`, `capture.recalled`, `level.deleted`, `belief.created`, `belief.reinforced`, `belief.recalled`, `belief.updated`, `belief.superseded`, `belief.tombstoned`, `belief.forgotten`, `edge.created`, `procedure.created`, `procedure.cracked`, `procedure.healed`, `procedure.step`, `clock.advanced`, `voice.received`, `snapshot`.

Rules:
- The engine holds one cluster-wide change stream and translates changes into these events. Sweeps coalesce `level.deleted` per capture.
- The same envelopes are appended to `event-log/*.jsonl` during ingest so replay mode can re-emit them on a timer for beat 1.
- Palace treats an unknown type as a no-op and logs it.

## Mascot (apps/mascot)

- Thin client. Every answer comes from `POST /ask`; the mascot never holds an Anthropic key. It holds the ElevenLabs key only for local speech-to-text of the user's voice; text-to-speech of answers is returned by the engine as `audio_url` when `speak: true`.
- Talks to the engine at `ENGINE_HTTP_URL`; subscribes to the same `/ws` feed to react (blink, nod) when memories are recalled or forgotten.

## Mock world (apps/mockworld)

- Listing pages expose every attribute as `data-*` on the root element: `data-listing-id`, `data-price`, `data-neighborhood`, `data-train`, `data-floor`, `data-elevator`, `data-laundry`, `data-pets`. The capture hook and the agent's `read_listing()` parse these; nothing reads the listings collection directly. The derived attribute `walkup_floor` (floor when there is no elevator, else 0) is computed by the parser with `walkupFloor()` from `@cortex/schema`, so the single-attribute rule DSL can express "no walk-up above the 3rd floor".
- Listing ids are stable strings `listing:NNN` and carry a `hunt` field (`hunt1`, `hunt2`, `agent`, `rerun`).
- Write endpoints (`POST /api/messages`, `POST /api/reject`) require `x-cortex-write-token`.

## Palace (apps/palace)

- Layout is deterministic from data: room by `belief.room`, position inside a room by a hash of `_id`. The server never sends coordinates.
- Visual mapping from `docs/spec.md` > "What each visual means". Clarity drives the painting blur shader; confidence drives glow; `status: cracked` shows cracks; `pinned` or `source: voice | manual` shows a gold frame; `inferred` threads are dashed.

## Persona fixtures (packages/persona/data)

| File | Schema | Content |
| --- | --- | --- |
| `listings.json` | `Listing[]` | About 60 listings with contrastive pairs, traps, and `hunt` (`pool` = shown in search results, in no scripted hunt) |
| `maya-script.json` | `ScriptStep[]` | Maya's month as ordered steps with pacing |
| `ground-truth.json` | `GroundTruth` | Her true rules with `active_from_day`, her style, and the 50 questions with answers, groups, and grading mode |
| `usage-log.json` | `UsageLogEntry[]` | Questions and tasks she runs on which days; housing recalls on the simulator's schedule |
| `inbox.json`, `calendar.json` | `Message[]`, `CalendarEvent[]` | Seeded noise and the lease thread |

## Sandbox verification

Run `pnpm atlas:check` with `ATLAS_URI` set. Record the output here once it passes.

```
(pending)
```
