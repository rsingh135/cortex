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

`capture.created`, `capture.recalled`, `level.deleted`, `belief.created`, `belief.reinforced`, `belief.recalled`, `belief.updated`, `belief.superseded`, `belief.tombstoned`, `belief.forgotten`, `edge.created`, `procedure.created`, `procedure.cracked`, `procedure.healed`, `procedure.step`, `clock.advanced`, `voice.received`, `agent.drafts`, `agent.draft_sent`, `snapshot`.

Rules:
- Beat 3 approval loop: the engine emits `agent.drafts` `{run_id, drafts: [{draft_id, listing_id, listing_title, to, text, because}]}` when a run pauses for presenter approval; the palace POSTs `/agent/drafts/:id/approve` and the engine answers with `agent.draft_sent` `{draft_id, message_id, because}`, whose `because` beliefs pulse.
- `capture.created` may carry `image_url`; when absent the palace requests `GET /image/:capture_id?condition=cortex` from the engine.
- The engine holds one cluster-wide change stream and translates changes into these events. Sweeps coalesce `level.deleted` per capture.
- The same envelopes are appended to `event-log/*.jsonl` during ingest so replay mode can re-emit them on a timer for beat 1.
- Palace treats an unknown type as a no-op and logs it.

Current implementation: `/ws?condition=cortex` (or `keep_all`, `blur_by_age`)
sends complete `snapshot` envelopes on connect and after committed changes. A
filtered database change stream triggers refreshes; fixture writes notify the
same path. Startup/recovery returns HTTP 503 until the stream is ready; stream
failures close clients with code 1011, and clients should reconnect. Semantic
event translation and JSONL event-log replay are still pending.

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

Run `pnpm atlas:check` with `ATLAS_URI` set. Verified 2026-09-26 against the hackathon sandbox (MongoDB 8.0.32, replica set, dedicated tier):

```
PASS  connection + server info            MongoDB 8.0.32, replica set primary
PASS  change stream delivers an insert    operationType=insert
PASS  TTL index accepted                  expireAfterSeconds=0
PASS  $graphLookup walks edges            procedure -> event, capture
PASS  Atlas Vector Search + $vectorSearch 512-dim cosine index queryable after 54s, top hit correct
```

Vector search indexes take about a minute to become queryable after creation; create them in setup, never on the request path.

## Capture intake details

`Capture.listing` optionally preserves the `listing_id` and `attrs` submitted in
`IngestCaptureMeta.listing`. Older captures remain valid without it. Ingest does
not infer a rejection/message decision solely from these attributes.

The engine accepts PNG/WebP captures up to 10 MiB and 16 million pixels. Duplicate
frames return the previous capture ID without adding ladder/state documents;
changes to the URL, action, page text, or listing metadata preserve a new event.
The simulated clock advances with chronological captures; captures older than the
current day are rejected. A missing episode is created for the supplied ID so
`play-maya --engine` can stream its predefined episode IDs and ends each episode
after its final selected capture, before advancing to the next episode or day.

Ending an episode currently creates an evidence-backed, deterministic activity
summary from capture metadata. Screenshot-to-fact model extraction remains pending;
raw `page_text` stays until extraction succeeds and is never included in snapshots.
