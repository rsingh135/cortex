# Cortex — Design Spec

v2 · Sep 26, 2026 · @Ranveer

Supersedes the v1 spec, which used the working name that this project has since dropped. Changes from v1: forgetting parameters made explicit and simulator-tuned, three-condition evaluation moved to canonical documents plus per-condition state ledgers, evaluation made observer-free, propagation rule extended to new preferences, rule DSL defined, single TypeScript monorepo. The hackathon brief is in `docs/brief.md`; API and event contracts are in `docs/contracts.md`.

## Pitch

**Cortex is a memory for your computer that remembers what you use, lets the rest fade, and then does your chores the way you would.**

**The problem.** Your AI forgets you the moment a chat ends. The tools that do remember you, like Rewind and Microsoft Recall, hoard full-resolution screenshots of everything forever. That's an archive, not a memory: it never gets smaller, never gets smarter, and keeps every password and private message it ever saw.

**What Cortex does.**

- **Watches as you work.** Screenshots are captured on meaningful events: page loads, clicks, form submits.
- **Turns them into beliefs.** A vision model distills each screenshot into small, structured facts about you: preferences, people, projects, routines.
- **Forgets like a brain.** Every screenshot slowly loses resolution. Memories you use get their clock reset and stay sharp. Memories nobody needs blur and disappear for good.
- **Learns your workflows.** Do a task twice and Cortex extracts the procedure and the preferences behind your choices. The third time, it does it for you.
- **Takes updates by voice.** A quick voice note becomes a belief immediately, and anything built on the old belief is revised.
- **Two views of one mind.** You walk a 3D memory palace to see, fix, or delete anything Cortex believes. The agent reads a compact 2D map of the same memory.

**How it differs.**

|  | Rewind / Recall / Screenpipe | Cortex |
| --- | --- | --- |
| What's stored | Every screenshot, full resolution, forever | Beliefs, plus screenshots that fade unless used |
| Storage over time | Grows without limit | Levels off |
| Private details | Kept indefinitely | Blur away with the screenshot |
| What it does with memory | Search | Acts: replays your workflows with your preferences |
| Can you correct it | Delete raw captures | Inspect, edit, or delete any belief |

**Statement fit.** Statement Two, Long Horizon Engineering: memory that stays coherent over weeks, optimizes for keeping what matters, and is judged by a hard number (answer accuracy per byte stored). Workflow learning is the harness adapting itself to one user.

**Judging fit.** Technical Demo (35%): a live browser agent acting on learned preferences, a palace that reacts to real database events. Implementation Difficulty (30%): a forgetting engine with tested parameters, a rule learner checked in code, a three-strategy evaluation. Creativity (15%): forgetting as a feature, a memory palace as the UI. Impact (20%): the privacy and storage problem of always-on screen memory.

**Closing line:** Recall remembers everything. Cortex remembers you.

## The demo

**Three minutes, live: Maya's memory forms, fades, gets used, gets corrected, and the chart proves the forgetting pays off.** Everything runs on a fake persona, so no real private data is ever on screen.

**The persona.** Maya just moved to New York and is apartment hunting. She has an inbox, a calendar, a listings site she browses, and landlords she messages. Her month of history is scripted and captured in advance.

| Beat | On screen | What the judge learns |
| --- | --- | --- |
| 1. Memory forms | Replay of Maya's day-2 apartment hunt. The month is already ingested; a replay script re-emits the day-2 ingest events on a timer so memories appear in the Housing room at a watchable pace. The last ~5 captures are extracted live with real vision calls | Screenshots become beliefs; the last few prove it's real |
| 2. Memory fades | Fast-forward three weeks. Neglected screenshots blur and vanish; the housing memories she kept returning to stay sharp | Forgetting is selective, driven by use |
| 3. Memory acts | "Find me apartments." The agent runs the hunt live in the browser over 6 new listings: skips the fifth-floor walk-up, the one without laundry, the over-budget one and the one off the L; drafts messages to the two landlords in Maya's voice and waits for the presenter to approve each. Each preference it uses pulses and re-sharpens | Memory drives real actions, and using a memory strengthens it |
| 4. Memory updates | Maya records a voice note: "I'm getting a dog." A new belief appears; the saved apartment-hunt procedure cracks. The agent re-runs over 4 listings and now skips the two that don't allow pets | Beliefs update, and everything built on them follows |
| 5. The proof | The chart: accuracy vs. storage over 30 simulated days for three memory strategies. Then the dream journal, once: Cortex says aloud what it kept and what it let go | Cortex stays small and still remembers what matters |

**The chart, described.** X axis: simulated day. Two panels. Top: bytes stored. Bottom: weighted accuracy on a fixed set of questions about Maya's life. Three lines each:

- **Keep everything** (Rewind-style): storage climbs steadily; accuracy stays high.
- **Blur by age**: storage levels off; accuracy falls, because important old memories blur too.
- **Cortex**: storage levels off like blur-by-age; accuracy stays close to keep-everything.

The one-sentence reading for a tired judge: *Cortex gets Rewind's accuracy at a fraction of the storage.*

The chart is computed offline before the demo. The live demo runs from a seeded day-24 snapshot of the Cortex condition.

## System overview

**One TypeScript monorepo around one MongoDB Atlas cluster: a mock world to act in, an engine that turns screens into fading memories and acts on them, and two views of the result.**

### Monorepo layout

| Path | Built with | Job |
| --- | --- | --- |
| `apps/mockworld` | Next.js on Vercel, UI scaffolded with v0 | Maya's listings site (MockLoft), inbox, calendar and landlord chat; the stage the demo runs on |
| `apps/palace` | Next.js + React Three Fiber on Vercel | The 3D memory palace; connects to the engine over WebSocket; also serves the agent's 2D map as JSON |
| `apps/mascot` | Electron + React | The Cortex mascot: a desktop pet that sits at the top of the screen, listens and talks through ElevenLabs, and answers questions from the real memory by calling the engine's `POST /ask` |
| `apps/engine` | One long-running Node process | Ingest, extraction, consolidation, forgetting sweep, workflow learner, agent, voice, propagation, evaluation harness. Holds one cluster-wide Atlas change stream and pushes events to the palace over WebSocket |
| `packages/schema` | zod | Every collection schema, enum, the rule DSL and checker, the forgetting math, WebSocket event envelope, API request and response types. Imported by every app and tool |
| `packages/persona` | JSON + Playwright | Listings dataset, Maya's scripted month, ground truth, question set, usage log |
| `tools/` | tsx scripts | `simulate.ts` (forgetting simulator), `atlas-check.ts` (sandbox feature verification), `reset-demo-db.ts` (day-24 snapshot reset) |

No Python anywhere. Playwright, sharp, the Anthropic TypeScript SDK, LangSmith JS, ElevenLabs JS and the MongoDB Node driver are all first-class.

### Models

| Job | Model | Why |
| --- | --- | --- |
| Belief extraction from screenshots | `claude-sonnet-5` | Hundreds of vision calls; fast and cheap, strict JSON output |
| Workflow learner, router, agent, evaluation judge | `claude-opus-5` | Reasoning-heavy, few calls |
| Embeddings | Voyage AI `voyage-3-lite`, 512 dimensions | MongoDB-owned, integrates with Atlas Vector Search; small vectors keep belief documents small |

All Claude calls use the Anthropic TypeScript SDK with adaptive thinking and streaming. The agent uses the SDK tool runner (`betaZodTool`) over a small Playwright tool set.

### Hosting

- **Demo:** everything runs on the demo laptop: engine, Playwright, palace, mock world. No venue Wi-Fi dependency beyond Atlas and the model APIs; a phone hotspot is the backup.
- **Judges' link:** mock world and palace are deployed to Vercel through the GitHub integration. The Vercel palace reaches the engine's WebSocket through a cloudflared tunnel.
- The engine is a long-running process by design: a change stream cannot live inside a serverless function.

### Data flow

1. **Capture.** Maya (scripted) or the agent acts in the mock world. Each meaningful event produces a screenshot, the URL, the action taken, and a timestamp.
2. **Ingest.** The screenshot is stored at every resolution level. Extraction turns it into beliefs, each linked to the screenshot as evidence and placed in a room.
3. **Consolidate.** New beliefs are deduplicated against existing ones: a match reinforces, a conflict creates an update case.
4. **Forget.** On each simulated day, the forgetting engine drops expired resolution levels and decays unused beliefs.
5. **Act.** A request goes to the agent. It routes it, recalls relevant beliefs and procedures, and acts. Every recall resets that memory's clock.
6. **Show.** Every change in Atlas fires the change stream; the palace spawns, pulses, blurs or cracks the matching object.

## Demo world: Maya and her mock apps

**Maya's month is scripted so the preferences Cortex should learn are unambiguous, and the memories it should forget are plentiful.** We build every site ourselves: reliable on stage, and no third-party brands or rights issues.

### Maya

- 27, product designer, moving from Chicago, starting a job near Union Square.
- Hidden preferences (the ground truth Cortex must discover):

| Preference | How it shows in her behavior |
| --- | --- |
| Budget at most $2,800 | Never opens listings above it |
| In-unit or in-building laundry | Rejects every listing without it |
| No walk-ups above the 3rd floor | Rejects high walk-ups; accepts high floors with an elevator |
| Near the L train | Only messages landlords of listings on the L |
| Pets allowed (after day 25) | Stated only in the voice note |

### The mock apps

| App | What it has | Built as |
| --- | --- | --- |
| MockLoft (listings) | About 60 listings: price, neighborhood, nearest train, floor, elevator, laundry, pets, photos, landlord. Every attribute is also exposed as `data-*` attributes on the listing page | Next.js pages over a listings collection |
| Inbox | Work threads, friends, landlord replies, a lease thread | Next.js mail view over a messages collection |
| Calendar | Design reviews, gym, a friend's birthday, viewings | Simple week view |
| Landlord chat | A message form on each listing; canned landlord replies | Writes to the messages collection |

Photos are CC0 stock or generated. The UI is plain and clearly fictional.

Write endpoints in the mock world (reject, message) require the header `x-cortex-write-token`, set by Maya's Playwright scripts and by the agent. The public Vercel deployment is therefore read-only to visitors.

### Designing the listings so preferences are learnable

- Each of Maya's hunts shows about 12 listings. She rejects some and messages others.
- Rejections come in **contrastive pairs**: two listings identical except one lacks laundry, and she rejects exactly that one. Two identical fifth-floor units, one with an elevator, and she keeps that one. With pairs like these, the learner can't mistake which attribute caused the rejection.
- The agent's live hunt (beat 3) uses **6 new listings** the agent has never seen: one of each trap (a walk-up above floor 3, a no-laundry unit, an over-budget one, one off the L) and two that pass every rule.
- The re-run after the voice note (beat 4) uses **4 listings**: two that pass every rule, and two that are perfect except for a no-pets rule.

Every listing has a stable id and a `hunt` field (`hunt1`, `hunt2`, `agent`, `rerun`, `noise`).

### The simulated month

| Day | Event |
| --- | --- |
| 1 | Arrives; sets up inbox and calendar |
| 2 | Apartment hunt #1 |
| 5 | Apartment hunt #2 |
| 3–20 | Ordinary life around the hunts: work email, design reviews, gym, a friend's birthday, one lease thread |
| ~3, 6, 13, 18 | Usage-log recalls of housing memories (see Usage log) |
| 24 | Asks the agent to hunt (live beat 3) |
| 25 | Voice note about the dog; agent re-runs (live beat 4) |
| 30 | End of the evaluation window |

Maya's actions are Playwright scripts with human-like pacing, so her history can be regenerated deterministically at any time. An **episode** is one Playwright script run or one agent run; scripts emit episode start and end explicitly.

### Usage log

**The usage log is the mechanism under test, and the spec says so.** It is a scripted list of questions Maya asks and tasks she runs on given days, replayed identically for every memory strategy. Only Cortex benefits from those recalls; that is the point of the comparison.

Housing recalls fall on approximately days 3, 6, 13 and 18. The exact days are chosen by `tools/simulate.ts` so that, under Cortex, a day-2 housing screenshot still has its L0 or L1 level alive on day 24, while under blur-by-age the same screenshot has at most its L3 thumbnail. Without those recalls the day-2 screenshots are gone by day 22 under every strategy, and beat 3 would have nothing to re-sharpen.

## Capture pipeline

**A screenshot is taken only when something meaningful happens, with the action that caused it, so every memory has context and the pipeline isn't flooded.**

### When to capture

| Trigger | Why |
| --- | --- |
| Page finished loading | A new thing is on screen |
| Click on a link, button or listing | Records a choice |
| Form submit or message sent | Records an action with consequences |
| Dwell: same page for 10+ seconds | Catches reading, which signals interest |

Skip a capture when it is nearly identical to the previous frame, using a perceptual hash with a small distance threshold. Scrolling alone never triggers a capture.

### What each capture records

- The screenshot (full viewport, encoded as WebP q80 at every level).
- URL, page title, and which app it is (MockLoft, Inbox, Calendar, Landlord chat).
- The action: type (load, click, submit, dwell), the element's visible text, and its bounding box.
- Who acted: Maya or the agent. The agent's own actions become memories too.
- The episode it belongs to and the simulated day.
- The page's visible text and, on listing pages, the structured listing attributes read from `data-*`. Both are hints for extraction and the source of decision records. `page_text` is deleted from the capture once extraction succeeds; the screenshot remains the memory.

### Where it runs

Capture hooks into the Playwright browser driving the mock world. Maya's scripted runs and the agent's live runs go through the same hooks and post to the engine's ingest endpoint.

Full-Mac capture (screen-wide screenshots on app switches) is the same pipeline with a different trigger source. It is future work, not part of the demo.

## Belief extraction

**Each screenshot becomes zero or more small, structured beliefs, each pointing back at the screenshot that proves it.** Beliefs are what the agent reasons with; screenshots are the evidence behind them.

### What a belief is

| Field | Example |
| --- | --- |
| Triple | (`maya`, `rejected`, `listing:214`) |
| Text | "Maya rejected a 5th-floor walk-up in Bushwick" |
| Kind | fact, event, person, preference, routine, style |
| Room | Housing |
| Evidence | Capture ids, plus the action that produced them |
| Source | screen, voice, learner, or agent outcome |

Predicates come from a fixed enum and objects use canonical ids (`listing:214`, `person:priya`, `event:design-review`) so that exact-match consolidation actually fires. Confidence lives in the per-condition `belief_state` (see Data model); its starting value depends on the source (see Parameters).

### Extraction call

- **Model:** `claude-sonnet-5`, image at L1 (half resolution is enough and halves cost).
- **Input:** the screenshot, the page text hint, the structured listing attributes when present, the action taken, and the previous 3 captures for context.
- **Output:** strict JSON via structured outputs, a list of beliefs matching the schema. An empty list is a valid answer.
- **Rule in the prompt:** state only what the screen shows or the action directly implies. No guessing at motives.
- **Rooms** come from a fixed list: Housing, Work, Social, Health, Errands, Misc. The model picks one per belief.

A single rejection is an **event**, never a preference. Preferences come only from the workflow learner, which looks across episodes for patterns, or from voice notes.

Every listing page capture also produces a **decision record** (see Workflow learning), parsed deterministically from the listing's `data-*` attributes and the action taken. The mock-world database is never read for this; the parser sees only what the browser saw.

### Consolidation

1. **Exact match** on subject, predicate and canonical object: reinforce the existing belief and add the new evidence.
2. **Near match** by vector similarity above 0.9 on the belief text embedding: same as above.
3. **Conflict** (same subject and predicate, different object): open an update case. Human-sourced beliefs beat screen-sourced ones; newer evidence beats older. The loser is marked superseded, never deleted, and keeps its history.

### Episode summaries

At the end of each episode, one summary belief records what happened in a sentence, for example: "Day 2: browsed 12 listings in Bushwick and Williamsburg; messaged 3 landlords." Summaries give the agent a cheap index of Maya's month.

## Forgetting engine

**Every screenshot is stored as a ladder of resolutions whose top rungs are deleted over time; using a memory resets its clock and lengthens how long it lasts.** Deleted rungs never come back, so the forgetting is real.

### The resolution ladder

| Level | Size | Clarity value | Base lifetime (sim days since last recall) |
| --- | --- | --- | --- |
| L0 | Full resolution | 1.00 | 2 |
| L1 | 1/2 | 0.75 | 5 |
| L2 | 1/4 | 0.50 | 10 |
| L3 | 1/8 thumbnail | 0.25 | 20 |
| Gone | Nothing stored | 0 | — |

Each level is its own document, so deleting a level is deleting a document.

### Two numbers per memory

- **Ceiling:** the sharpest level still stored. It only ever goes down.
- **Clarity:** how sharp the memory is right now, as shown to the agent and in the palace. It fades continuously between recalls and can never exceed the ceiling's value.

When the agent looks at a memory's screenshot, it receives the sharpest alive level whose clarity value is at or below the current clarity; if none qualifies, it receives the lowest alive level. A faded memory is genuinely less useful, so forgetting has consequences.

### Recall re-sharpens

When the agent uses a memory:

1. Clarity snaps back up to the ceiling's value. In the palace, the painting visibly comes back into focus.
2. The clock that erodes the ceiling resets to zero.
3. The recall count goes up, and every level's lifetime doubles (capped at 8×). Memories used repeatedly become durable, like spaced repetition.

Recall can restore clarity only up to the ceiling. A memory whose L0 and L1 are gone can never be seen at full resolution again.

**Recall cascade.** The agent cites beliefs, not screenshots. Recalling a belief recalls its `evidence` captures, and follows `derived_from` one hop to the events that support it and their captures. Each capture is cascaded at most once per agent run, so a hunt that uses four preferences doesn't multiply-count one screenshot.

### Beliefs outlive their screenshots

- A belief can keep high confidence after all its screenshots are gone. That's knowing a fact but forgetting where you learned it.
- A belief is forgotten when its confidence drops below 0.1 and no evidence remains.
- Human-sourced beliefs (voice notes, manual edits) decay at a quarter of the normal rate.
- Pinned beliefs ("remember this" by voice) never decay.

### Two clocks, one logic

- **Simulated clock (demo and evaluation).** A clock document in Atlas holds the current simulated day. Advancing it runs a forgetting sweep that deletes expired levels and decays beliefs. Fast-forward is just advancing the clock.
- **Real-time mode (production).** Each level document carries an `expires_at` date with a TTL index, and Atlas deletes it automatically. A recall pushes `expires_at` forward. The same rules, enforced by the database itself.

## Parameters

**One table holds every number the forgetting engine and the evaluation depend on.** It is mirrored in `packages/schema/src/forgetting.ts`, which every app imports, and tuned by `tools/simulate.ts` before anything is ingested. Change the number here and in that file, nowhere else.

| Parameter | Value | Notes |
| --- | --- | --- |
| Level base lifetimes L0 / L1 / L2 / L3 | 2 / 5 / 10 / 20 sim days | Days since last recall before the level is deleted |
| Lifetime multiplier | min(2^r, 8) | r = recall count of the capture |
| Level clarity values L0 / L1 / L2 / L3 | 1.00 / 0.75 / 0.50 / 0.25 | Clarity ceiling when that level is the sharpest alive |
| Clarity | c(t) = value(ceiling) × exp(−λc · Δd / min(2^r, 8)) | Δd = sim days since last recall |
| λc | ln 2 / 4 | Clarity half-life of 4 days at r = 0 |
| Served level | Sharpest alive level with value ≤ clarity; else the lowest alive level | What the agent and the evaluation answerer see |
| Confidence c0, screen event | 0.3 | A single sighting |
| Confidence c0, learner preference | 0.5 + 0.1 × (decisions explained) + 0.1 × (contrastive pairs), capped at 0.95 | Set by the learner's check step |
| Confidence c0, voice | 0.9 | Maya said it |
| Confidence c0, pinned | 1.0, no decay | "Remember this" |
| Confidence decay | c(t) = c0 × exp(−λb · Δd / min(2^r, 8)) | r = recall count of the belief |
| λb | ln 2 / 20 | Confidence half-life of 20 days at r = 0 |
| Human-sourced decay | λb × 0.25 | Voice notes, manual edits |
| Reinforce on match | c ← c + 0.3 × (1 − c) | Exact or near-match consolidation |
| Forgotten | c < 0.1 and no alive evidence | Belief status becomes forgotten |
| Blur by age (baseline) | Same rules with r forced to 0 and no clarity restore on recall | Isolates the effect of use |
| Keep everything (baseline) | No level deletion, no confidence decay | Rewind-style |
| Recall cascade | Belief → its evidence captures; one hop via `derived_from` → supporting events → their captures | Once per capture per agent run |

### Storage accounting

Every level stores its byte size. Bytes per strategy per day = bytes of alive image levels + BSON size of each active belief excluding its embedding. Embeddings are stored as int8 BinData and excluded from every strategy equally. Every level in every strategy is WebP q80, so keep-everything is not penalized by a heavier format. `page_text` is deleted after extraction in every strategy, so the empty "forgotten" frame is honest and keep-everything is not undercounted.

## Workflow learning

**After Maya does the same task twice, Cortex writes down three things: the steps, the rules behind her choices, and how she sounds.** Every rule is checked in code against everything she actually did before it's trusted.

### Noticing a repeated workflow

After each episode, compare it with earlier episodes: same app, similar sequence of actions, similar summary (vector similarity on the episode summary). When two episodes match, they become a workflow candidate and the learner runs. For the demo, hunts #1 and #2 are the pair.

### Decision records

Every listing Maya sees becomes a decision record, built deterministically from the listing page's `data-*` attributes and what she did next:

```
decision: { episode_id, listing_id,
            attrs: { price, neighborhood, train, floor, elevator, laundry, pets },
            outcome: "unopened" | "rejected" | "messaged",
            capture_ids }
```

The attributes come from captures, never from the mock-world database. Reading the database would be leakage a real system cannot do; the database is used only to audit the parser's accuracy.

### The rule DSL

```
rule: { attr, op: "<=" | ">=" | "==" | "!=" | "in", value,
        then: "skip" | "prefer",
        support: [decision ids] }
```

Rules are data, so they can be tested, cited, shown in the palace and revised without touching a prompt.

### What the learner produces

| Output | Example | Stored as |
| --- | --- | --- |
| Procedure | Open MockLoft → filter by price and area → for each listing: read it, skip or message → send message | A procedure in the Housing room, with ordered steps, parameters and `decision_attributes` |
| Decision rules | `price <= 2800`; `laundry != none`; `floor <= 3 or elevator == true`; `train in [L]` | Preference beliefs whose payload is a rule, each linked to the procedure step that uses it |
| Voice | Short, friendly, mentions a Sept 1 move-in, always asks about laundry | A style belief used when drafting messages |

### How rules are learned and checked

1. **Propose.** Give `claude-opus-5` both episodes' decision records. Ask for the simplest rules, in the DSL, that explain her choices.
2. **Check.** Test every proposed rule in code against every decision from both runs. A rule contradicted by any decision is dropped.
3. **Tighten.** For threshold rules, the loosest value consistent with every decision is chosen (2,800 rather than 2,750 if both fit). Contrastive-pair support ranks ties between competing rules.
4. **Score.** Confidence follows the Parameters table: 0.5, plus 0.1 per decision explained, plus 0.1 per contrastive pair confirming it, capped at 0.95.
5. **Link.** Each surviving rule gets `derived_from` edges to the events that support it, and the procedure gets `uses` edges to the rules.

The check step is what makes this more than a prompt: rules are hypotheses tested against evidence, not a model's guess.

### In the palace

A new procedure appears in the Housing room as an object with its steps around it. Threads connect it to the rules it uses, and each rule connects to the screenshots of the rejections that taught it.

## The agent

**The agent decides whether a request needs Maya's memory at all, pulls only what it needs, and cites the beliefs behind every action.** Every memory it uses gets re-sharpened.

### Routing

| Request type | Example | What happens |
| --- | --- | --- |
| General | "What's a broker fee?" | Answered directly. No recall, no memory touched |
| Personal | "When is Priya's birthday dinner?" | Recall from memory, answer, cite the evidence |
| Workflow | "Find me apartments" | Match a learned procedure and run it |

A small classifier call makes the decision. Workflow matching compares the request with procedure names and descriptions.

### Recall

1. Read the 2D map (see the palace section) to pick which rooms are relevant.
2. Search those rooms: exact subject match first, vector search as a fallback.
3. Rank by relevance × confidence × clarity.
4. Return belief text and, when useful, the evidence screenshot at its served level.
5. Log the recall, which resets the memory's clock, re-sharpens it and cascades to its evidence. Recalls made by the evaluation harness pass `dry_run: true` and do none of this.

### Replaying a workflow

The agent runs the procedure in the browser with Playwright, using a small tool set:

- `open(url)`, `filter(price, area)`, `open_listing(id)`
- `read_listing()`: reads the listing's `data-*` attributes from the DOM and returns structured JSON. No vision call per listing.
- `skip(listing, because=[rule ids])`
- `draft_message(listing)`: drafts from the style belief, returns the draft for presenter approval
- `send_message(listing, text)`: only after approval; only ever to the mock landlord chat

Sequence in the live hunt: the agent opens and reads all 6 listings (parallel tool calls), makes one decision call that assigns skip or message to each listing with the rule ids it relied on, then acts sequentially. The browser and the model are pre-warmed before the beat starts.

Every skip or message must cite the preference beliefs it relied on. Those citations drive the pulses in the palace and the re-sharpening. The agent's own captures go through ingest like Maya's, so its run becomes an episode too.

### Learning from outcomes

If Maya or the presenter overrides a decision ("actually, message that one"), the override is logged as evidence against the rule that caused it. Its confidence drops; enough overrides and the rule is superseded.

## Voice notes and updates

**Speaking to Cortex is the fastest way to change what it believes, and changes ripple to everything built on the old belief.**

### The path of a voice note

1. Hold to talk in the palace.
2. ElevenLabs speech-to-text returns a transcript.
3. Extraction runs on the transcript with the same schema as screenshots. Source is `voice`; starting confidence is 0.9.
4. A separate **inference prompt** asks what the new fact implies for existing procedures' `decision_attributes`. "I'm getting a dog" yields the inferred preference `pets == true`, marked `inferred`. The extraction prompt's "no guessing" rule is untouched; inference is its own step with its own visible marker.
5. Consolidation adds, updates, or removes beliefs.
6. Propagation finds and cracks everything that depended on what changed.

The transcript is kept as evidence. The audio itself isn't stored.

### Three kinds of update, plus pinning

| Say | What happens |
| --- | --- |
| "I'm getting a dog" | New fact, plus an **inferred** preference: pets allowed is now required. The inferred belief links to the voice note with a dashed thread, so it's visibly a conclusion rather than something Maya said |
| "My budget is now $3,000" | Conflicts with the existing budget belief. The old one is superseded, with history kept |
| "Forget the Bushwick place" | The matching beliefs are tombstoned and their screenshots deleted immediately |
| "Remember this" (about the belief on screen) | The belief is pinned: confidence 1.0, no decay. Answers the rare-but-important case |

### Propagation

Procedures carry `decision_attributes`, the listing attributes their decide step looks at (`["price", "laundry", "floor", "elevator", "train", "pets"]`). When a preference is upserted:

- **Changed belief:** a `$graphLookup` over `uses` and `derived_from` edges finds every procedure that depends on it.
- **New belief:** `procedures.find({ room, decision_attributes: rule.attr })` finds every procedure in the same room that decides on that attribute. The new belief's id is appended to the decide step's `uses`.

Each procedure found is marked **cracked**:

- The procedure's rule set is updated to include the change.
- In the palace, the procedure object shows cracks.
- The next successful run with the new rule heals the cracks and re-sharpens everything it used.

In the demo, this is beat 4: "I'm getting a dog," the apartment-hunt procedure cracks, and the re-run skips listings that don't allow pets.

## The mascot

**Cortex has a face: a small desktop pet that sits at the top of the screen, listens, talks, and answers from the same memory the palace shows.** It is the everyday way to use Cortex; the palace is the way to inspect it.

- A frameless, transparent, always-on-top Electron window, click-through except over the pet.
- Hold to talk. ElevenLabs speech-to-text turns the question into text; the mascot sends it to `POST /ask`; the engine routes it (general, personal, workflow), recalls, answers with belief citations, and returns ElevenLabs audio. The mascot speaks it.
- Every belief the answer cites is a real recall: it re-sharpens in memory and pulses in the palace at the same moment.
- The pet reacts to the memory's life on the `/ws` feed: a nod when something is recalled, a shiver when a screenshot is forgotten, a stretch after a fast-forward.
- The mascot holds no Anthropic key and no memory of its own. It is a thin client; the engine owns the Claude call and the LangSmith trace.

In the demo the mascot is how Maya asks "when is Priya's birthday dinner?" and how the dream journal is spoken after the fast-forward.

## The palace and the agent's map

**Humans walk through a dark, open 3D graph of what Cortex believes; the agent reads a compact 2D floor plan of the same memory.** Both are generated from the same Atlas data, so what you see is exactly what the agent knows.

### Layout

- Open space, no walls: a deep charcoal void with a faint star field for depth.
- Six clusters float on a ring, one per semantic room (Housing, Work, Social, Health, Errands, Misc), each in its own colour with the room name floating above it and a count of its memories.
- Each cluster shows the room's strongest beliefs, five per room by confidence, as glowing nodes. Summaries are never shown; the rest of the memory stays reachable through the agent's map and the cards.
- Thin edges connect beliefs: learner edges (`derived_from`, `uses`, `supersedes`) brighter, shared-evidence links (two beliefs from the same screenshot) fainter.
- Layout is deterministic: cluster positions are fixed by room, node positions come from a hash of the belief `_id` relaxed so nodes never overlap, so the same memory always draws the same graph and the server never stores positions.
- The original room-and-corridor palace remains at `/rooms` as a fallback view.

### What each visual means

| Visual | Meaning |
| --- | --- |
| Node size and glow | Belief confidence; low-confidence beliefs shrink and dim |
| Flicker out | The belief was forgotten, superseded, or dropped out of its room's top five |
| Pulse | The agent just recalled this belief |
| Edge brightness | The weaker endpoint's confidence; edges fade with their beliefs |
| Gold node | Came from Maya directly (voice note or edit) or is pinned |
| Cluster colour | The room the belief lives in |

Screenshots are not nodes. Their fading shows in the belief's card: evidence thumbnails at the served level, blurring as clarity drops, and "forgotten" when every rung is gone. That card is still the image that sells the idea: Cortex knows the fact, but the moment it learned it is gone.

### Interactions

- Walk with WASD and the mouse, or press Tab for an orbit camera; walk straight into a cluster.
- Hover a node to read the belief; click it to open its card: text, confidence over time, evidence thumbnails at served level, recall count, history, LangSmith trace link, and Edit and Delete.
- Hold to talk for a voice note.
- A timeline scrubber sets the simulated day; fast-forward advances it and runs the forgetting sweep, and nodes dim, shrink and flicker out.
- A storage meter shows Cortex's bytes against what keep-everything would have stored.
- Approve or reject a drafted landlord message during the live hunt; `B` opens the mock world beside the graph.
- Demo hotkeys: `R` replays day 2, `J` dream journal, `C` chart, `F` fallback video, `V` voice fallback, `A` approve drafts.

### Rendering

- React Three Fiber and drei; a sphere and an additive glow sprite per node, one line-segments draw call for every edge, billboarded text for labels.
- Atlas change stream events arrive over WebSocket from the engine and animate the matching nodes. On reconnect the palace fetches `GET /snapshot` and rebuilds.

### The agent's 2D map

A small JSON floor plan the agent reads before recalling anything. It lists rooms, their top active beliefs and procedures, recent changes, and anything currently cracked. Superseded, tombstoned and forgotten beliefs are filtered out. About 500 tokens, however large the memory grows.

```json
{
  "day": 24,
  "rooms": [
    { "name": "Housing", "beliefs": 41, "procedures": ["apartment_hunt"],
      "top": ["price <= 2800", "laundry != none", "floor <= 3 or elevator", "train in [L]"],
      "cracked": [] },
    { "name": "Social", "beliefs": 17, "top": ["Priya's birthday dinner Oct 3"] }
  ],
  "recent_changes": []
}
```

## Data model

**Canonical memory documents are written once; each evaluation strategy keeps its own small state ledger.** Identical pixels and identical extractions go into every strategy; only the forgetting policy differs, which is the strongest form of the comparison. All ids are string ULIDs.

### Canonical memory collections

```json
// captures: one per screenshot event
{ "_id", "episode_id", "day": 5, "actor": "maya|agent", "app": "mockloft", "url", "title",
  "action": { "type": "click", "text": "Reject", "bbox": [412, 88, 96, 32] },
  "listing_attrs": { "price": 2650, "floor": 5, "elevator": false, "laundry": "none", "train": "L", "pets": false },
  "page_text": "...",            // deleted after extraction succeeds
  "phash": "c3a1..." }

// image_levels: one document per rung of the ladder
{ "_id", "capture_id", "level": "L0|L1|L2|L3", "bytes": 84233, "format": "webp",
  "data": BinData, "expires_at": ISODate }   // expires_at used only in real-time mode

// beliefs
{ "_id", "triple": { "s": "maya", "p": "requires", "o": "laundry" },
  "text": "Maya needs laundry in the unit or building",
  "kind": "fact|event|person|preference|routine|style", "room": "Housing",
  "source": "screen|voice|learner|agent_outcome", "inferred": false, "pinned": false,
  "rule": { "attr": "laundry", "op": "!=", "value": "none", "then": "skip" },   // preferences only
  "evidence": ["capture ids"], "trace_url": "...",
  "embedding": BinData(int8, 512), "superseded_by": null }

// edges
{ "_id", "from", "to", "type": "derived_from|uses|evidence|supersedes", "weight": 1.0 }

// procedures
{ "_id", "name": "apartment_hunt", "room": "Housing", "status": "active|cracked",
  "decision_attributes": ["price", "laundry", "floor", "elevator", "train", "pets"],
  "steps": [ { "n": 1, "do": "open", "args": { "url": "/listings" } },
             { "n": 3, "do": "decide", "uses": ["belief ids"] } ],
  "learned_from": ["episode ids"], "runs": 1, "last_run_day": 24 }

// decisions
{ "_id", "episode_id", "listing_id": "listing:214",
  "attrs": { "price": 2650, "neighborhood": "Bushwick", "train": "L", "floor": 5, "elevator": false, "laundry": "none", "pets": false },
  "outcome": "unopened|rejected|messaged", "capture_ids": ["..."] }

// episodes, recalls, voice_notes, clock
{ "_id", "day": 2, "actor": "maya|agent", "app": "mockloft", "summary": "...", "workflow": "apartment_hunt" }
{ "_id", "condition": "cortex", "target": "belief or capture id", "day": 24, "by": "agent|maya|eval",
  "reason": "skip listing:311", "dry_run": false, "cascaded_from": null }
{ "_id", "day": 25, "transcript": "I'm getting a dog", "beliefs": ["ids"] }
{ "_id": "clock", "day": 25, "mode": "simulated|realtime" }
```

### Per-condition state ledgers

```json
// capture_state: one per (condition, capture)
{ "_id", "condition": "cortex|keep_all|blur_by_age", "capture_id",
  "alive_levels": ["L1", "L2", "L3"], "ceiling": "L1", "clarity": 0.62,
  "recalls": 2, "last_recall_day": 21 }

// belief_state: one per (condition, belief)
{ "_id", "condition", "belief_id", "confidence": 0.86, "recalls": 3, "last_recall_day": 24,
  "status": "active|cracked|superseded|tombstoned|forgotten" }
```

Bytes for a condition on a day are computed from `capture_state.alive_levels` joined to `image_levels.bytes`, plus the BSON size of each active belief without its embedding. The evaluation never deletes canonical documents.

### The demo database

The live demo runs only the `cortex` condition, seeded from a day-24 snapshot. In that database the forgetting sweep **physically deletes** `image_levels` documents, so the change stream, the TTL story and the empty frames are all real. The evaluation uses the ledgers; the demo uses deletion. Both apply the same functions from `packages/schema/src/forgetting.ts`.

### Mock world

- `listings`: id, price, neighborhood, train, floor, elevator, laundry, pets, photos, landlord, `hunt`.
- `messages`: inbox threads and landlord chat, including the agent's outgoing messages.
- `calendar_events`: Maya's month.

Full-resolution WebP screenshots are well under MongoDB's 16 MB document limit, so storing levels as `BinData` inside documents is fine. That's also what lets a TTL index delete them.

## How MongoDB Atlas is load-bearing

**Forgetting, propagation, the live palace and the agent's map are each implemented by an Atlas feature, not just stored in one.** Swap out the database and those behaviors have to be rebuilt.

| Atlas feature | What Cortex uses it for | Why it matters |
| --- | --- | --- |
| TTL indexes | Deleting expired image levels in real-time mode; a recall pushes `expires_at` forward | The database itself does the forgetting |
| Change streams | One cluster-wide stream in the engine drives the live palace and triggers propagation when a belief changes | Every visual in the demo reacts to a real database event |
| `$graphLookup` | Finding every procedure and belief that depends on a changed belief; walking a belief back to its screenshots | This is how an update ripples |
| Atlas Vector Search with Voyage AI embeddings | Near-duplicate beliefs, fallback recall, matching repeated workflows | Catches the same memory in different words |
| Aggregation pipeline | The agent's 2D map (group by room, rank by confidence, top N); the chart's bytes and accuracy per day from the state ledgers | The map and the chart are queries, not code |
| Document model | A belief carries its triple, rule, evidence and history together; image levels are small binary documents | Each rung of a memory is one deletable document |

Everything runs in the Atlas sandbox cluster provided for the hackathon, which finalists are required to use.

**First check before building on it:** `tools/atlas-check.ts` confirms TTL indexes, change streams, a 512-dimension vector search index and `$graphLookup` all work on the sandbox cluster, and records the cluster tier in `docs/contracts.md`.

## Sponsor technologies

**Cortex uses all four technologies the hackathon names, each doing a real job rather than a logo placement.**

| Technology | Job in Cortex | Where it shows in the demo |
| --- | --- | --- |
| MongoDB Atlas (sandbox cluster) | The entire memory: beliefs, image ladders, state ledgers, TTL forgetting, propagation, live updates, Voyage AI vector search | Everywhere; see the previous section |
| ElevenLabs speech-to-text | Voice notes become beliefs | Beat 4: "I'm getting a dog" |
| ElevenLabs text-to-speech | The dream journal, once at the end of the demo: Cortex says aloud what it kept and what it let go. Example: "I let 140 screenshots fade. I kept everything about your apartment search." Audio is pre-generated from the deterministic day-24 sweep stats | Beat 5 |
| LangSmith | Traces every extraction, learner and agent call. Each belief card links to the trace that created it. The evaluation runs as LangSmith experiments over a dataset of the 50 questions, one experiment per memory strategy per checkpoint day | Beat 5, and in Q&A: "why does it believe this?" |
| Vercel | Hosts the mock world and the palace through the GitHub integration; v0 scaffolds the mock apps' UI during the event | The link judges open |

The engine that holds the change stream runs outside Vercel; the palace on Vercel connects to it over a tunneled WebSocket.

## Evaluation

**Two measurements: accuracy per byte of memory over 30 simulated days, and whether the agent's apartment decisions match Maya's.** Both compare Cortex against baselines on identical inputs, and the evaluation never touches the memory it measures.

### Memory strategies compared

| Strategy | Screenshots | Beliefs | Recall effect |
| --- | --- | --- | --- |
| Keep everything | Full resolution forever | Never decay | None |
| Blur by age | Levels drop on the base schedule (r = 0) | Decay by age | None |
| Cortex | Levels drop, lifetime grows with use | Decay slows with use | Resets clock, restores clarity, cascades to evidence |

All three share the same canonical captures and extractions and diverge only in their state ledgers.

### Usage during the month

The usage log (see Demo world) is replayed identically for every strategy. Only Cortex benefits from those recalls.

### Question set

Fifty questions with known answers, in three fixed groups:

| Group | Count | Weight | Examples | What it must require | Expected result |
| --- | --- | --- | --- | --- | --- |
| Used often | 20 | 60% | Budget, laundry, recurring design review, Priya's birthday | Beliefs | Cortex matches keep-everything |
| Seen once, never needed again | 20 | 25% | A unit number on a listing Maya never revisited, the exact price of an unextracted listing, an old newsletter's subject line | The screenshot itself, at a resolution that fails as levels drop | Cortex and blur-by-age both forget, by design |
| Rare but important | 10 | 15% | Lease signing date | Beliefs | Cortex may forget unless Maya pins it by voice |

Rules for the set:

- Seen-once questions must be answerable only from the screenshot, not from any belief, and must depend on small text that a lower level cannot resolve. If beliefs alone could answer every question, screenshot storage would not affect accuracy and the chart would be trivial.
- Used-often questions are paraphrases of usage-log queries, never identical strings.
- Weights are fixed here before any run. Report the weighted score, the unweighted score, each group separately, and accuracy per megabyte.
- **Calibration run** before the evaluation: answer each seen-once question at L0, L1, L2 and L3 and record the level at which the answer fails. This validates the premise that lower resolution loses information, independently of any strategy.

### How accuracy is measured

- On days 5, 10, 15, 20, 25 and 30, a per-condition snapshot of the state ledgers is taken. An answering agent (`claude-opus-5`) gets only that strategy's snapshot: active beliefs, plus screenshots at their served level.
- Every recall the answering agent makes is `dry_run: true`: nothing is logged, no clock resets, no clarity is restored. The evaluation observes; it never strengthens the memory it measures.
- Answers are graded against the known answers: exact match where possible, a `claude-opus-5` judge otherwise.
- Bytes stored are computed per strategy on the same days from the ledgers, per the Storage accounting rule.
- Tokens per answer are logged as a secondary number.
- The evaluation runs as LangSmith experiments: one dataset, one experiment per strategy per checkpoint day.

### The workflow measurement

For the agent's live hunt, compare its decisions with what Maya's true rules say:

- Correct skips and correct messages, as a count out of the 6 listings shown, and out of the 4 in the re-run.
- Against an agent with no memory, which has only the request.
- Before and after the voice note, to show the pets rule taking effect.

### The closing chart

Two stacked panels over simulated days: bytes stored on top (stacked bands for images and beliefs), weighted accuracy below, one line per strategy. The workflow result sits beside it as a single line: "Cortex: 6 of 6 decisions right. No memory: 2 of 6." (placeholder numbers until the runs are done). The chart is rendered offline before the demo and shown as a pre-rendered image in the palace and in the slides.

## Demo operations

**Every live beat has a deterministic fallback that goes through the same UI.**

- **Reset.** `tools/reset-demo-db.ts` restores the demo database to the day-24 snapshot in one command. Rehearsals are impossible without it.
- **Replay mode.** Every ingest and sweep of the seeded month is recorded as a JSONL event log with original timestamps. Beat 1 replays the day-2 events on a timer; a hotkey switches any other beat to replaying its recorded action log through the same palace and browser.
- **Voice fallback.** A hotkey sends a pre-recorded WAV of "I'm getting a dog" through the same ElevenLabs speech-to-text endpoint; a text input is the fallback behind that.
- **Agent fallback.** If the live hunt stalls for 20 seconds, a hotkey switches to the recorded action log of the exact run.
- **Chart.** Pre-rendered PNG.
- **Dream journal.** Pre-generated audio from the deterministic day-24 sweep stats, played once at the end.
- **Network.** Engine and palace on the demo laptop; `GET /snapshot` on WebSocket reconnect; phone hotspot as backup.
- **Reset between rehearsals** is the same one command.

## Work breakdown

**Everything that needs to exist for the full build, grouped by owner.** Three people, three tracks, one trunk. Ownership and branch rules are in `CONTRIBUTING.md` and `.github/CODEOWNERS`.

### Foundations (shared, done first)

- [x] `packages/schema`: collection schemas, enums, rule DSL and checker, forgetting math, WebSocket envelope, API types, unit tests
- [x] `tools/simulate.ts` passes its assertions with the Parameters table and outputs the usage-log recall days
- [x] `docs/contracts.md`: endpoints, WebSocket events, listing schema, palace layout rule, write gating, mascot contract
- [x] Monorepo scaffold: pnpm workspaces, turborepo, `apps/mockworld`, `apps/palace`, `apps/engine`, `apps/mascot`, `packages/persona`, `.env.example`, README, CI
- [x] Atlas sandbox project created from the hackathon invite link
- [x] `tools/atlas-check.ts` passes: TTL indexes, change streams, 512-dim vector search index, `$graphLookup`; result recorded in `docs/contracts.md`
- [ ] Public repository with the team added; Vercel projects connected through the GitHub integration

### Track 1: palace (3D and 2D visualization), demo ops, chart

- [x] Fixture mode: seeded fake memory, canvas placeholder screenshots, fake event ticker, so the palace runs with no engine
- [x] Belief graph: six room clusters in open dark space, top five beliefs per room, deterministic node placement; first-person walk and orbit; room palace kept at `/rooms`
- [x] Nodes sized and lit by confidence, edges by the weaker endpoint, forgotten nodes flicker out; screenshot clarity shown in the card thumbnails
- [x] Pulse, cracks, solid and dashed threads, gold frames, Archive alcove
- [ ] Belief card with edit, delete, trace link; draft approval control for the live hunt
- [x] Timeline scrubber, fast-forward with sweep animation, storage meter, `/map` page with the agent's JSON
- [x] WebSocket client with `GET /snapshot` on reconnect; split view with the browser for the live hunt
- [x] Two-panel chart page (`/chart`) from engine `/stats` or the simulated series; accuracy lines once the eval runs
- [x] `tools/reset-demo-db.ts` (save/restore verified on the sandbox); bundled day-2 event log built from real captures; `play-maya --usage-log` replays recalls during ingest; day-24 snapshot procedure in `docs/demo.md`
- [x] Replay mode wired to the `R` hotkey; hotkeys for every fallback (`F`, `V`, `J`, `C`, `A`); bundled dream-journal and voice clips
- [ ] `fallback.mp4` recording of a full run; `A` needs pending draft ids from the engine
- [ ] Vercel projects for the mock world and the palace through the GitHub integration; cloudflared tunnel for the WebSocket
- [x] Demo script for the five beats (`docs/demo.md`)
- [ ] Rehearsed on the demo machine; one-minute demo video; closing note listing what was built

### Track 2: memory engine, persona, mock world

- [ ] Capture policy: when to screenshot (load, click, submit, dwell), perceptual-hash dedupe, capture record with listing attributes
- [ ] Resolution ladder generation (L0–L3, WebP q80) and storage as level documents; byte accounting per strategy per day
- [ ] Extraction prompt with structured outputs; room assignment; `page_text` deletion after success; decision record parser
- [ ] Consolidation: exact match on canonical triples, Voyage vector match, conflict handling with supersede; episode summaries
- [ ] Simulated clock and advance endpoint; sweep over the state ledgers with physical deletion in the demo database; real-time TTL mode
- [ ] Recall: exact subject match then `$vectorSearch`, ranking, cascade, `dry_run`, clarity restore, clock reset, lifetime extension; served-level image endpoint
- [ ] Workflow learner: repeated-episode detection, rule proposal, rule checker, procedure and preference beliefs with edges and `decision_attributes`
- [ ] Router, 2D map aggregation, `POST /ask` for the mascot and palace with citations and optional ElevenLabs audio
- [ ] Agent loop on the SDK tool runner with mandatory rule citations, batch decision, draft approval; override handling as negative evidence
- [ ] Voice extraction with the inference prompt and `inferred` marking; pinning; propagation via `$graphLookup` plus attribute match
- [ ] One cluster-wide change stream and the WebSocket server; `GET /snapshot`
- [ ] Evaluation harness: three ledgers from identical captures, usage-log replay, per-checkpoint snapshots, dry-run answering agent, grader, calibration run, workflow decision scoring
- [ ] LangSmith tracing around every Claude call; `trace_url` on each belief; datasets and experiments per strategy per checkpoint
- [x] Persona: listings dataset with contrastive pairs and traps, Maya's scripted month with explicit episodes, ground truth, question set, usage log
- [x] Mock world: MockLoft with `data-*` attributes, Reject and message form, inbox, calendar, canned replies, write gating, v0 scaffolds, CC0 photos
- [ ] Agent replay tools over Playwright: `open`, `filter`, `open_listing`, `read_listing`, `skip`, `draft_message`, `send_message`; recorded action logs for the fallback

### Track 3: mascot

- [x] Electron shell: transparent always-on-top window, click-through outside the pet, tray menu, top-centre placement
- [ ] Pet design and animation states: idle, listening, thinking, speaking, reacting (nod on recall, shiver on forget, stretch after fast-forward)
- [ ] Hold to talk with ElevenLabs speech-to-text; text composer fallback
- [ ] `POST /ask` client with speech playback of the returned audio; cited-belief count in the bubble
- [ ] `/ws` subscription for reactions; reconnect with backoff
- [ ] Persona and voice: a calm narrator voice from the ElevenLabs library; the spoken dream journal after the fast-forward
- [ ] Packaging for the demo laptop; fallback: pre-recorded answers behind a hotkey

## Risks and rule compliance

**The main risks are a flaky live browser run and judges filing this under "another Recall"; both have concrete answers.**

### Risks

| Risk | Mitigation |
| --- | --- |
| Live browser replay fails on stage | Mock site we control, fixed seed data, 6 listings only, pre-warmed browser and model, 20-second stall hotkey to the recorded action log through the same UI |
| Beat 1 extraction too slow live | Month pre-ingested; replay of recorded ingest events on a timer; only ~5 captures extracted live |
| Stage microphone or speech-to-text fails | Pre-recorded WAV through the same endpoint by hotkey; text input behind it |
| Housing screenshots gone before day 24 | Usage-log recall days chosen by the simulator; assertion checked before ingest |
| Evaluation looks rigged | Fixed groups and weights before any run, dry-run recalls, paraphrased questions, calibration run, per-group and per-megabyte reporting, blur-by-age as an ablation that differs from Cortex only by recall |
| Extraction produces noisy or duplicate beliefs | Structured outputs, fixed room list, predicate enum and canonical ids, consolidation by exact triple first |
| Learner infers the wrong rule | Contrastive pairs in the data; every rule checked in code against every decision |
| Judges see "another Recall" | Lead with forgetting and acting, not capturing: the chart and the live hunt are things Recall can't show |
| Judges see "basic RAG" | The demo's centerpiece is an agent acting in a browser and a memory that changes shape, not a Q&A box |
| Judges see "a dashboard" | The palace is interactive: voice notes, edits, deletes and approvals change what the agent does next |
| TTL deletion runs about once a minute | Real-time mode only; the demo and evaluation use the simulated clock |
| Change streams need a long-running process | The engine is one long-running Node process, not serverless functions |
| WebSocket drops and blanks the palace | `GET /snapshot` on reconnect; engine on the demo laptop |
| Vision calls get expensive | Event-based capture, perceptual-hash dedupe, L1 images to the extraction model |
| Public mock world gets spammed | Write endpoints gated by `x-cortex-write-token` |
| Private data on stage | Everything uses the Maya persona; no real accounts |

### Rule compliance

| Rule | How Cortex meets it |
| --- | --- |
| Built in the Atlas sandbox cluster | Every collection lives there; `atlas-check` records the cluster |
| Public repository | Public from the first commit |
| Up to four team members | Three |
| Demo shows only work built at the event | The event has already started; every commit is inside the window. A closing note lists what was built |
| No existing projects | New code only; the v1 planning document predates code but not the event |
| Rights to all code, data and assets | Our own mock sites, fictional persona and brands, CC0 or generated images |
| Not a banned project type | Not basic RAG, not an image analyzer, not a dashboard-first app, no Streamlit, no health or education framing |

## Open decisions

**Each has a default so nothing blocks; edit the default column to change it.**

| Decision | Default | Alternatives |
| --- | --- | --- |
| Level lifetimes and λ values | Parameters table, as tuned by `tools/simulate.ts` | Shorter lifetimes for a more dramatic fast-forward, if the simulator's assertions still pass |
| Dream journal voice (resolved: ElevenLabs premade "Sarah", `EXAVITQu4vr4xnSDxMaL`; library voices need a paid plan via API) | A calm narrator voice from the ElevenLabs library, voice id chosen at build | A voice designed for Cortex |
| Question set wording | Drafted with the ground-truth file, frozen before the first evaluation run | — |

## Sources

- [DeepSeek-OCR: Contexts Optical Compression (arXiv 2510.18234)](https://arxiv.org/abs/2510.18234): about 97% text recovery at under 10× optical compression, about 60% at 20×; proposes progressively blurred images as a forgetting mechanism. The inspiration for fading screenshots.
- [Memory as Metabolism (arXiv 2604.12034)](https://arxiv.org/pdf/2604.12034): summarizes follow-up work contesting the optical-compression mechanism.
- [Screenpipe: Rewind alternative in 2026](https://screenpi.pe/blog/rewind-ai-alternative-2026): Meta acquired Limitless on December 5, 2025; Rewind's capture was disabled on December 19, 2025.
- [Screenpipe: personal AI memory in 2026](https://screenpipe.com/blog/personal-ai-memory-2026): landscape of always-on screen memory, including Microsoft Recall's privacy problems.
- [Google Codelabs: Survivor Network](https://codelabs.developers.google.com/codelabs/survivor-network/instructions): a 3D graph memory agent; inspired dashed inferred links. No code reused.
- [Voyage AI documentation](https://docs.voyageai.com): embedding models, including `voyage-3-lite`, and int8 output.
- [Atlas Vector Search documentation](https://www.mongodb.com/docs/atlas/atlas-vector-search/): index definitions, `$vectorSearch`, and Voyage AI integration.
