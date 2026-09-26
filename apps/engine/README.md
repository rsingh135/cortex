# @cortex/engine

**Owner: memory track** (capture policy, screenshot degradation, forgetting, Mongo search and connections, extraction, learner, agent, voice). One long-running Node process. Palace and mascot are clients of its HTTP + WebSocket surface, defined in [`docs/contracts.md`](../../docs/contracts.md) and typed in `@cortex/schema`.

## Run

```bash
pnpm --filter @cortex/engine dev              # tsx watch; needs root .env (ATLAS_URI; AI/agent keys are separate)
FIXTURE_MODE=true pnpm --filter @cortex/engine dev   # in-memory ledger, no Atlas: captures, episodes, snapshot, recall, clock, images, stats
pnpm --filter @cortex/engine typecheck && pnpm --filter @cortex/engine lint && pnpm --filter @cortex/engine test
```

## Module map

| Dir | State | Spec section | What it does |
| --- | --- | --- | --- |
| `src/ingest/policy.ts` | done | Capture pipeline | Pure decision: which browser signals capture (load, actionable click, submit, dwell ≥ 10s), never scroll; near-duplicate by phash distance ≤ 4 |
| `src/ingest/phash.ts` | done | Capture pipeline | 64-bit average hash with sharp + Hamming distance |
| `src/ingest/intake.ts` | done | Capture pipeline, Data model | Validated PNG/WebP → contextual deduplication → canonical capture, image ladder, all condition ledgers, episode count; extraction remains pending |
| `src/ingest/episodes.ts` | metadata summaries | Capture pipeline | Start/end episodes and create a recallable activity summary with screenshot evidence |
| `src/ladder/` | done | Forgetting engine › resolution ladder | `buildLadder`: L0 full, L1 ½, L2 ¼, L3 ⅛, all WebP q80; `degradeForServing` for the served level |
| `src/forgetting/plan.ts` | done | Forgetting engine, Parameters | Pure `planSweep` (levels to delete, ceilings, clarity, confidences, forgotten beliefs) and `planRecall` (cascade to evidence) using `@cortex/schema` math |
| `src/forgetting/sweep.ts` | ledger mode | Forgetting engine › two clocks | Applies `planSweep` through transactional `MemoryStore`; writes `daily_stats` |
| `src/db/repo.ts` | partial | Data model, Atlas load-bearing | Repository interface; Mongo implementation has trivial reads, the rest `NotImplemented` |
| `src/extraction/` | ready | Belief extraction | System prompt, strict zod output, `client.beta.messages.parse` on `claude-sonnet-5` with the L1 image. Needs `ANTHROPIC_API_KEY` and LangSmith wrapping |
| `src/consolidation/` | stub | Belief extraction › consolidation | Exact → near (cosine ≥ 0.9) → conflict/supersede; algorithm in the doc comment |
| `src/recall/rank.ts` | done | The agent › recall | relevance × confidence × clarity |
| `src/recall/embed.ts` | partial | Data model | HTTPS Voyage/Atlas client with 512-dim validation; int8 pack/unpack + cosine |
| `src/recall/search.ts` | exact/text | The agent › recall, Evaluation | Room filters, exact subject first, text fallback, rank, one-hop evidence cascade, read-only `dry_run`; vector fallback pending |
| `src/learner/` | stub | Workflow learning | Rule proposal on `claude-opus-5`, checked with `checkRules` from `@cortex/schema/rules` |
| `src/agent/` | stub | The agent | Router, Playwright replay tools with citations, drafts awaiting approval |
| `src/voice/` | stub | Voice notes and updates | ElevenLabs STT/TTS, inference prompt, pinning, tombstone |
| `src/propagation/` | stub | Voice notes › propagation | `$graphLookup` + `decision_attributes` match → crack/heal |
| `src/live/events.ts` | done | The palace › rendering | Change-stream event → `WsEvent` translation (beliefs, captures, levels, procedures, edges, voice) |
| `src/live/server.ts` | stub | The palace › rendering | One cluster-wide change stream, `ws` broadcast, `/snapshot` on connect |
| `src/api/app.ts` | partial | contracts.md | Every route, validated with `@cortex/schema/api`; handlers return 501 until wired |

Unimplemented HTTP handlers return 501; module stubs throw `NotImplemented("<module>")` from `src/lib/errors.ts`.

## Build order

1. Live snapshot updates for palace clients.
2. Wire screenshot extraction and consolidation into the transactional ledger.
3. Embed beliefs and add vector fallback to recall.
4. Learner → propagation → agent → voice → eval harness.

Parameters live in `packages/schema/src/forgetting.ts` only. Never copy the math.

## Memory ledger slice

The server wires capture intake, episode start/end, `/snapshot`, `/recall`,
`/clock/advance`, `/image/:capture_id`, and `/stats` to `db/memory-store.ts`. Mongo operations use snapshot transactions;
fixture mode uses an isolated in-memory store. Both use the existing forgetting
planners and recall ranker. The store currently loads the small hackathon dataset
per operation; it is not intended for an unbounded production archive. This
transaction boundary supplements `Repo`; consolidation repository methods
remain unfinished.

Clock advancement requires all three conditions together because they share one
clock. It updates condition ledgers and daily byte statistics, retaining canonical
images for the comparison. Physical demo deletion, realtime TTL, and live WebSocket
broadcasts remain unimplemented. Realtime clock documents are rejected by this
store. Atlas transactions require a replica set/Atlas cluster.

Recall searches exact subjects first, then deterministic text matches. It returns
beliefs with current evidence-image URLs, restores Cortex recall clocks through
`planRecall`, and logs each evidence capture once per request. Dry runs write
nothing. Voyage/vector fallback and procedure retrieval remain pending.

No sample memories are seeded automatically. Upload PNG/WebP screenshots through
`POST /ingest/capture` with multipart `image` and JSON `meta` fields. Intake retains
listing hints and pending page text, builds all four image levels, and skips near
duplicates only when the action and page context are unchanged. Captures may
auto-create an episode using the supplied ID, supporting the scripted browser.
`POST /episodes/:id/end` creates a deterministic activity summary with screenshot
evidence that can be recalled immediately. Screenshot fact extraction and inferred
preferences remain pending; summaries describe only capture metadata. Fixture mode
starts empty. The root `.env` is loaded by the entry point.

## Atlas model API

Atlas model keys authenticate embedding requests at `https://ai.mongodb.com/v1`.
They do not authenticate the Atlas administration CLI or replace `ATLAS_URI`.
Keep `VOYAGE_API_KEY` in the ignored root `.env`; set `VOYAGE_BASE_URL` and
`VOYAGE_EMBEDDING_MODEL` as shown in `.env.example`. The current Atlas setup uses
`voyage-4-lite` at 512 dimensions. The client retains its legacy model default for
existing callers; set the model explicitly for Atlas. Changing models requires
rebuilding stored embeddings before using them for similarity search.

Run `pnpm --filter @cortex/engine embeddings:check` to make one small live request.
This command requires only the model API configuration and never prints the key
or vector contents. The reusable client is in `src/recall/embed.ts`; wiring it
into indexed recall and consolidation remains the next memory slice.

Documentation: https://www.mongodb.com/docs/voyageai/api-and-clients/

## Live Atlas verification

The implemented memory HTTP endpoints boot with `ATLAS_URI` alone. Full AI/agent
configuration remains separate, so a missing Claude key does not block memory
storage, recall, images, or forgetting.

- `pnpm --filter @cortex/engine memory:check` exercises actual Atlas transactions,
  concurrent duplicate uploads, episode summaries, concurrent recalls, dry runs,
  rollback, snapshots, BSON image bytes, and
  condition-specific forgetting using the real HTTP handlers.
- `pnpm atlas:check` verifies change streams, TTL index support, `$graphLookup`, and
  creation/query of a 512-dimensional vector index. It does not wait for TTL deletion.

Each command creates a unique temporary database and removes it in a `finally`
block. Neither command seeds or deletes the configured `ATLAS_DB` database.
