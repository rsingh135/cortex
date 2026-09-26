# Cortex: spec v2 + foundations

## Context

Repo holds one file, `cortex — Design Spec.md`, a hackathon design spec still named "Loci". User wants the spec hardened, renamed to Cortex, and the project set up (repo, schema, contracts, verification tooling) before component build begins. Hackathon (MongoDB Atlas, Statement Two "Long Horizon Engineering") has already started, so all work is allowed now. Judging: Technical Demo 35%, Implementation Difficulty 30%, Creativity 15%, Impact 20%.

Two review passes (delivery risk, technical/eval validity) found real gaps in the spec: forgetting math that erases every housing screenshot before the live hunt, an evaluation that perturbs the memory it measures, a propagation rule that cannot crack a procedure for a *new* preference, a polyglot stack with no shared schema, 3x storage from `condition`-on-every-doc, and unfair byte accounting. This pass fixes the spec and lays foundations. Component build is a later pass after user review.

## Decisions locked with user

| Decision | Choice |
|---|---|
| Name | Cortex (everywhere; closing line "Recall remembers everything. Cortex remembers you.") |
| Team | 3, all full-stack TS. No hour estimates anywhere in the plan or spec. |
| Stack | Single TypeScript monorepo (pnpm 12 + turborepo). No Python. |
| Models | `claude-sonnet-5` extraction; `claude-opus-5` learner, router, agent, judge. Anthropic TS SDK, adaptive thinking, streaming, tool runner (`betaZodTool`) for the agent. |
| Embeddings | Voyage AI `voyage-3-lite` (512-dim), stored as int8 BinData. User creating key. |
| Eval storage | Canonical `captures` / `image_levels` / `beliefs` written once; per-condition `capture_state` and `belief_state` ledgers. Demo DB (cortex condition) still physically deletes level docs. |
| Agent listing read | Structured DOM read (`data-*` attrs to JSON). Screenshots still captured as agent memories. |
| Beat 1 | Hybrid: month pre-ingested; replay stored change events on a timer; last ~5 captures extracted live. |
| Hosting | Everything on demo laptop. Mock world + palace also on Vercel via GitHub integration (never run Vercel CLI). Live server tunneled (cloudflared) for the Vercel palace. |
| Atlas | Dedicated tier (M10+). Foundations still verifies every feature. |
| Keys ready | Atlas URI, Anthropic, ElevenLabs, LangSmith. Voyage pending. Vercel + v0 ready. |
| Spec defaults kept | Pinning by voice; agent's own actions become memories. |
| Spec defaults flipped | Landlord messages: agent shows draft, presenter approves. Dream journal: once, at end of demo (pre-generated audio). |
| Spec location | `docs/spec.md`; old root file deleted. Brief saved to `docs/brief.md`. |
| This pass | Spec v2 + foundations, then stop for review. |

## Deliverable 1: `docs/spec.md` (Cortex spec v2)

Rewrite the existing spec with these edits. Keep the pitch, demo beats, palace visuals, sponsor table, rule compliance. Every "Loci" becomes "Cortex".

**Parameters table (new section, single source of truth, mirrored in `packages/schema/src/forgetting.ts`):**
- Level bases L0/L1/L2/L3 = 2/5/10/20 sim days; lifetime = base × min(2^r, 8).
- Level values L0=1.0, L1=0.75, L2=0.5, L3=0.25. Clarity c(t) = value(ceiling) × exp(−λc·Δd / min(2^r,8)), λc = ln2/4. Image served to agent = sharpest alive level with value ≤ clarity, else lowest alive level.
- Confidence c0: screen event 0.3; learner preference = 0.5 + 0.1×(decisions explained) capped 0.95, +0.1 per contrastive pair; voice 0.9; pinned 1.0 and no decay. Decay exp(−λb·Δd / min(2^r,8)), λb = ln2/20; human-sourced ×0.25. Reinforce: c ← c + 0.3(1−c). Forgotten when c < 0.1 and no alive evidence.
- Blur-by-age = identical rules with r forced to 0 and no clarity restore. Keep-everything = no deletion, no decay.
- Recall cascade: recalling a belief recalls its `evidence` captures, and one hop via `derived_from` to supporting events and their captures. One cascaded recall per capture per agent run.

**Usage log:** scripted recalls of housing memories on days chosen by the simulator (approx. 3, 6, 13, 18) so day-2 L0/L1 survive to day 24 under Cortex and are gone under blur-by-age. State this openly as the mechanism being tested.

**Evaluation integrity:**
- Checkpoint queries run with `dry_run: true`: no recall log, no clock reset, no clarity restore. Query a per-condition snapshot.
- Eval questions are paraphrases of usage-log queries, never identical strings.
- Question groups fixed: 20 used-often / 20 seen-once / 10 rare-important; weights 60/25/15. Seen-once questions must be screenshot-only and resolution-sensitive (unit numbers, exact prices on unextracted listings, newsletter subject lines). Report weighted, per-group, and accuracy per MB.
- Calibration run before the eval: answer each seen-once question at L0..L3 and record the failing level.
- Chart is computed offline before the demo; the live demo runs from a seeded day-24 snapshot.

**Byte accounting:** bytes = alive image level bytes + bsonsize(belief) excluding embedding, identical across conditions. WebP q80 for every level. `page_text` deleted from `captures` after extraction succeeds (all conditions).

**Propagation:** procedures carry `decision_attributes: [...]`. On preference upsert: `$graphLookup` over `uses`/`derived_from` for changed beliefs, plus `procedures.find({room, decision_attributes: rule.attr})` for new ones; append belief id to the `decide` step's `uses`; mark cracked.

**Rule DSL and decisions:**
```
rule:     { attr, op: "<=|>=|==|!=|in", value, then: "skip"|"prefer", support: [decision ids] }
decision: { episode_id, listing_id, attrs: {price, neighborhood, train, floor, elevator, laundry, pets}, outcome: "unopened|rejected|messaged", capture_ids }
```
Attributes come from captures (deterministic parser over the listing page's `data-*` / page text), never from the mock-world DB. Threshold rules pick the loosest consistent value; contrastive-pair support ranks ties.

**Consolidation:** predicate enum + canonical object ids (`listing:214`, `person:priya`) so exact match actually fires; vector near-match at 0.9 second.

**Agent:** live hunt = 6 listings (4 traps + 2 good). Agent reads all six via DOM tool (parallel tool calls), one decision call citing rule ids, then acts sequentially; drafts 2 landlord messages from the style belief and waits for presenter approval. Pre-warm browser and model. Re-run after voice note = 4 listings incl. 2 no-pets traps.

**Voice:** separate inference prompt for "dog → pets required" (the extraction prompt's "no guessing" rule stays).

**Other definitions:** episode = one Playwright script run or one agent run, emitted explicitly; 2D map filters `status: active` and adds `recent_changes`; mock-world write endpoints gated by a shared header set by Playwright/agent; one cluster-wide change stream on the engine; deterministic palace layout from `_id` hash + room.

**Architecture section:** replace the eleven-component table with the monorepo layout below. Remove FastAPI and the Python job.

**Demo ops:** one-command reset to day-24 snapshot; event-log replay mode for all five beats; hotkeys for recorded fallback; pre-recorded WAV through the same STT endpoint as voice fallback; pre-rendered chart PNG.

**Suggested 3-way split (in spec, "Work breakdown"):**
- P1: mock world + persona/ground truth + capture hooks + agent replay tools (all drive the same Playwright).
- P2: engine: ingest, extraction, consolidation, forgetting, learner, propagation, voice, eval harness.
- P3: palace + live server + demo ops + chart + sponsor wiring (TTS, LangSmith, Vercel/v0).

**Sources:** keep; add Voyage AI / Atlas Vector Search docs.

## Deliverable 2: repo foundations

```
cortex/
  package.json  pnpm-workspace.yaml  turbo.json  tsconfig.base.json  .gitignore  .env.example  README.md
  docs/spec.md  docs/brief.md  docs/contracts.md
  packages/schema/        zod schemas, enums, rule DSL + checker, forgetting math, WS envelope, API types; vitest
  packages/persona/       (scaffold only) listings.json, maya-script.json, ground-truth.json, questions.json, usage-log.json as empty typed stubs
  apps/mockworld/         create-next-app scaffold, no features
  apps/palace/            create-next-app scaffold + R3F deps, no features
  apps/engine/            Node/tsx scaffold: src/index.ts boots nothing yet; deps: mongodb, @anthropic-ai/sdk, playwright, sharp, langsmith, ws, zod
  tools/simulate.ts       forgetting simulator
  tools/atlas-check.ts    sandbox feature verification
  tools/reset-demo-db.ts  stub with signature only
```

**`packages/schema/src/`:**
- `enums.ts`: Room, Kind, Status, Level, Condition, Source, ActionType, Predicate, WsEventType.
- `collections.ts`: zod for captures, image_levels, beliefs, belief_state, capture_state, edges, procedures, decisions, episodes, recalls, voice_notes, clock, listings, messages, calendar_events. String ULIDs for `_id`.
- `forgetting.ts`: `Params` object with the defaults above; `lifetime(level, r)`, `clarity(ceiling, dd, r)`, `confidence(c0, dd, r, humanSourced)`, `reinforce(c)`, `servedLevel(alive, clarity)`, per-condition variants.
- `rules.ts`: Rule, Decision types; `checkRule(rule, decisions)`, `explain(rule, decisions)`, `looseningThreshold(...)`.
- `events.ts`: WS envelope `{type, id, day, payload}` and payload schemas.
- `api.ts`: request/response zod for `POST /ingest/capture`, `POST /clock/advance`, `POST /recall` (with `dry_run`), `GET /image/:capture_id`, `POST /learn`, `POST /voice`, `GET /map`, `GET /snapshot`.
- Unit tests: forgetting math against hand-computed values; rule checker against a 4-listing contrastive fixture.

**`docs/contracts.md`:** the endpoints, WS event list, listing schema with stable ids and `hunt` field, palace layout rule, ingest header gating.

**`tools/simulate.ts`:** inputs = capture days per app, usage log, Params → per day per condition: alive levels, bytes, belief confidence. Assertions: (a) Cortex keeps ≥1 of L0/L1 for a day-2 housing capture at day 24; (b) blur-by-age has only L3 or nothing; (c) non-housing day-8 captures are gone by day 24 under Cortex; (d) a voice belief at 0.9 stays > 0.5 at day 30. Prints a params table and suggested usage-log recall days. Runs via `pnpm simulate`.

**`tools/atlas-check.ts`:** against `ATLAS_URI`, in a throwaway `_cortex_check` database: open a change stream and observe an insert; create a TTL index and confirm via `listIndexes`; run a `$graphLookup` over a 3-node edge fixture; create a vector search index (512-dim, cosine) and poll to READY, run one `$vectorSearch`; print cluster tier from `buildInfo`/`hello`. Drops the database at the end. Runs via `pnpm atlas:check`.

**`.env.example`:** `ATLAS_URI`, `ANTHROPIC_API_KEY`, `VOYAGE_API_KEY`, `ELEVENLABS_API_KEY`, `LANGSMITH_API_KEY`, `LANGSMITH_TRACING=true`, `CORTEX_WRITE_TOKEN`, `LIVE_SERVER_WS_URL`.

**README.md:** what Cortex is (3 lines), layout, setup steps, the two verification commands, link to spec and contracts. States plainly that everything in the repo was built during the hackathon.

## Not in this pass

Mock-world features, extraction prompts, engine logic, palace rendering, eval runs, Vercel deploys, v0 scaffolds, LangSmith wiring. All start after user reviews spec v2 and foundations.

## Verification

1. `pnpm install` clean; `pnpm -r typecheck` and `pnpm -r lint` pass.
2. `pnpm --filter @cortex/schema test` passes (forgetting math, rule checker).
3. `pnpm simulate` prints the table and all four assertions pass with the default Params and suggested usage log.
4. `pnpm atlas:check` passes against the sandbox with `ATLAS_URI` set; output recorded in `docs/contracts.md` under "Sandbox verification".
5. `docs/spec.md` contains no "Loci"; old root file removed; `git status` shows only intended files.
6. Commit as its own command (no chained push); user pushes separately.
