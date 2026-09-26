# Loci — Design Spec

Sep 26, 2026 · @Ranveer

## Pitch

**Loci is a memory for your computer that remembers what you use, lets the rest fade, and then does your chores the way you would.**

**The problem.** Your AI forgets you the moment a chat ends. The tools that do remember you, like Rewind and Microsoft Recall, hoard full-resolution screenshots of everything forever. That's an archive, not a memory: it never gets smaller, never gets smarter, and keeps every password and private message it ever saw.

**What Loci does.**

- **Watches as you work.** Screenshots are captured on meaningful events: page loads, clicks, form submits.
- **Turns them into beliefs.** A vision model distills each screenshot into small, structured facts about you: preferences, people, projects, routines.
- **Forgets like a brain.** Every screenshot slowly loses resolution. Memories you use get their clock reset and stay sharp. Memories nobody needs blur and disappear for good.
- **Learns your workflows.** Do a task twice and Loci extracts the procedure and the preferences behind your choices. The third time, it does it for you.
- **Takes updates by voice.** A quick voice note becomes a belief immediately, and anything built on the old belief is revised.
- **Two views of one mind.** You walk a 3D memory palace to see, fix, or delete anything Loci believes. The agent reads a compact 2D map of the same memory.

**How it differs.**

|  | Rewind / Recall / Screenpipe | Loci |
| --- | --- | --- |
| What's stored | Every screenshot, full resolution, forever | Beliefs, plus screenshots that fade unless used |
| Storage over time | Grows without limit | Levels off |
| Private details | Kept indefinitely | Blur away with the screenshot |
| What it does with memory | Search | Acts: replays your workflows with your preferences |
| Can you correct it | Delete raw captures | Inspect, edit, or delete any belief |

**Statement fit.** Primarily Statement Two: memory that stays coherent over weeks, optimizes for keeping what matters, and is judged by a hard number (answer accuracy per byte stored). Workflow learning also touches Statement One: the harness adapts itself to a specific user.

**Closing line:** Recall remembers everything. Loci remembers you.

## The demo

**Three minutes, live: Maya's memory forms, fades, gets used, gets corrected, and the chart proves the forgetting pays off.** Everything runs on a fake persona, so no real private data is ever on screen.

**The persona.** Maya just moved to New York and is apartment hunting. She has an inbox, a calendar, a listings site she browses, and landlords she messages. Her month of history is scripted and captured in advance.

| Beat | On screen | What the judge learns |
| --- | --- | --- |
| 1. Memory forms | Replay of Maya's two apartment hunts. As she browses and rejects listings, memories appear in the Housing room of the palace | Screenshots become beliefs in real time |
| 2. Memory fades | Fast-forward three weeks. Neglected screenshots blur and vanish; the housing memories she kept returning to stay sharp | Forgetting is selective, driven by use |
| 3. Memory acts | "Find me apartments." The agent runs the hunt live in the browser: skips the fifth-floor walk-up, skips the one without laundry, messages two landlords in Maya's voice. Each preference it uses pulses and re-sharpens | Memory drives real actions, and using a memory strengthens it |
| 4. Memory updates | Maya records a voice note: "I'm getting a dog." A new belief appears; the saved apartment-hunt procedure cracks. The agent re-runs and now skips listings that don't allow pets | Beliefs update, and everything built on them follows |
| 5. The proof | The chart: accuracy vs. storage over 30 simulated days for three memory strategies | Loci stays small and still remembers what matters |

**The chart, described.** X axis: simulated day. Two panels. Top: bytes stored. Bottom: accuracy on a fixed set of questions about Maya's life. Three lines each:

- **Keep everything** (Rewind-style): storage climbs steadily; accuracy stays high.
- **Blur by age**: storage levels off; accuracy falls, because important old memories blur too.
- **Loci**: storage levels off like blur-by-age; accuracy stays close to keep-everything.

The one-sentence reading for a tired judge: *Loci gets Rewind's accuracy at a fraction of the storage.*

## System overview

**Eleven components around one MongoDB Atlas cluster: a mock world to act in, a pipeline that turns screens into fading memories, an agent that uses them, and two views of the result.**

### Components

| Component | Built with | Job |
| --- | --- | --- |
| Mock world | Next.js on Vercel, UI scaffolded with v0 | Maya's listings site, inbox and landlord messages; the stage the demo runs on |
| Capture | Playwright | Screenshots and action logs on page loads, clicks and submits |
| Ingest service | Python, FastAPI | Stores image levels, calls extraction, writes beliefs and evidence |
| Extraction | Claude (vision) | Screenshot → beliefs, room assignment, episode summary |
| Forgetting engine | Python job + Atlas | Drops resolution levels and decays beliefs on the simulated clock |
| Workflow learner | Claude | Two demonstrations → a procedure plus the preferences behind it |
| Agent | Claude + Playwright | Routes questions, recalls memories, replays workflows in the browser |
| Voice | ElevenLabs speech-to-text and text-to-speech | Spoken updates in; the spoken dream journal out |
| Tracing and evaluation | LangSmith | Traces every model call and agent run; runs the three-strategy evaluation |
| Live server | Node | Holds Atlas change streams open; pushes events to the palace over WebSocket |
| Palace | React Three Fiber on Vercel | The 3D memory palace; also serves the agent's 2D map as JSON |

The live server must be a long-running process (Render, Railway, Fly, or a laptop). Serverless functions can't hold a change stream open.

### Data flow

1. **Capture.** Maya (scripted) or the agent acts in the mock world. Each meaningful event produces a screenshot, the URL, the action taken, and a timestamp.
2. **Ingest.** The screenshot is stored at every resolution level. Extraction turns it into beliefs, each linked to the screenshot as evidence and placed in a room.
3. **Consolidate.** New beliefs are deduplicated against existing ones: a match reinforces, a conflict creates an update case.
4. **Forget.** On each simulated day, the forgetting engine drops expired resolution levels and decays unused beliefs.
5. **Act.** A request goes to the agent. It routes it, recalls relevant beliefs and procedures, and acts. Every recall resets that memory's clock.
6. **Show.** Every change in Atlas fires a change stream; the palace spawns, pulses, blurs or cracks the matching object.

## Demo world: Maya and her mock apps

**Maya's month is scripted so the preferences Loci should learn are unambiguous, and the memories it should forget are plentiful.** We build every site ourselves: reliable on stage, and no third-party brands or rights issues.

### Maya

- 27, product designer, moving from Chicago, starting a job near Union Square.
- Hidden preferences (the ground truth Loci must discover):

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
| MockLoft (listings) | About 60 listings: price, neighborhood, nearest train, floor, elevator, laundry, pets, photos, landlord | Next.js pages over a listings collection |
| Inbox | Work threads, friends, landlord replies, a lease thread | Next.js mail view over a messages collection |
| Calendar | Design reviews, gym, a friend's birthday, viewings | Simple week view |
| Landlord chat | A message form on each listing; canned landlord replies | Writes to the messages collection |

Photos are CC0 stock or generated. The UI is plain and clearly fictional.

### Designing the listings so preferences are learnable

- Each hunt shows about 12 listings. Maya rejects some and messages others.
- Rejections come in **contrastive pairs**: two listings identical except one lacks laundry, and she rejects exactly that one. Two identical fifth-floor units, one with an elevator, and she keeps that one. With pairs like these, the learner can't mistake which attribute caused the rejection.
- The third hunt (the agent's) uses **new listings** the agent has never seen, including one of each trap: a walk-up, a no-laundry unit, an over-budget one, and one off the L.
- After the voice note, the re-run set includes two listings that are perfect except for a no-pets rule.

### The simulated month

| Day | Event |
| --- | --- |
| 1 | Arrives; sets up inbox and calendar |
| 2 | Apartment hunt #1 |
| 5 | Apartment hunt #2 |
| 3–20 | Ordinary life around the hunts: work email, design reviews, gym, a friend's birthday, one lease thread |
| 24 | Asks the agent to hunt (live beat 3) |
| 25 | Voice note about the dog; agent re-runs (live beat 4) |
| 30 | End of the evaluation window |

Maya's actions are Playwright scripts with human-like pacing, so her history can be regenerated deterministically at any time.

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

- The screenshot (full viewport PNG).
- URL, page title, and which app it is (MockLoft, Inbox, Calendar, Landlord chat).
- The action: type (load, click, submit, dwell), the element's visible text, and its bounding box.
- Who acted: Maya or the agent. The agent's own actions become memories too.
- The episode it belongs to and the simulated timestamp.
- The page's visible text as a hint for extraction. The screenshot remains the memory; the text only improves extraction accuracy.

### Where it runs

In the demo, capture hooks into the Playwright browser driving the mock world. Maya's scripted runs and the agent's live runs go through the same hooks.

Full-Mac capture (screen-wide screenshots on app switches) is the same pipeline with a different trigger source. It is future work, not part of the demo.

## Belief extraction

**Each screenshot becomes zero or more small, structured beliefs, each pointing back at the screenshot that proves it.** Beliefs are what the agent reasons with; screenshots are the evidence behind them.

### What a belief is

| Field | Example |
| --- | --- |
| Triple | (Maya, rejected, listing 214) |
| Text | "Maya rejected a 5th-floor walk-up in Bushwick" |
| Kind | fact, event, person, preference, routine |
| Room | Housing |
| Confidence | 0.3 for a single sighting |
| Evidence | Screenshot ids, plus the action that produced them |
| Source | screen, voice, or agent outcome |

### Extraction call

- **Input:** the screenshot, the page text hint, the action taken, and the previous 3 captures for context.
- **Output:** strict JSON, a list of beliefs matching the schema. An empty list is a valid answer.
- **Rule in the prompt:** state only what the screen shows or the action directly implies. No guessing at motives.
- **Rooms** come from a fixed list: Housing, Work, Social, Health, Errands, Misc. The model picks one per belief.

A single rejection is an **event**, never a preference. Preferences come only from the workflow learner, which looks across episodes for patterns (next sections).

### Consolidation

1. **Exact match** on subject and predicate with the same object: reinforce the existing belief and add the new evidence.
2. **Near match** by vector similarity above 0.9: same as above.
3. **Conflict** (same subject and predicate, different object): open an update case. Human-sourced beliefs beat screen-sourced ones; newer evidence beats older. The loser is marked superseded, never deleted, and keeps its history.

### Episode summaries

At the end of each episode, one summary belief records what happened in a sentence, for example: "Day 2: browsed 12 listings in Bushwick and Williamsburg; messaged 3 landlords." Summaries give the agent a cheap index of Maya's month.

## Forgetting engine

**Every screenshot is stored as a ladder of resolutions whose top rungs are deleted over time; using a memory resets its clock and lengthens how long it lasts.** Deleted rungs never come back, so the forgetting is real.

### The resolution ladder

| Level | Size | Lasts (days since last recall, before any recalls) |
| --- | --- | --- |
| L0 | Full resolution | 2 |
| L1 | 1/2 | 5 |
| L2 | 1/4 | 10 |
| L3 | 1/8 thumbnail | 20 |
| Gone | Nothing stored | — |

Each level is its own document, so deleting a level is deleting a document.

### Two numbers per memory

- **Ceiling:** the sharpest level still stored. It only ever goes down.
- **Clarity:** how sharp the memory is right now, as shown to the agent and in the palace. It fades continuously between recalls.

When the agent looks at a memory's screenshot, it receives the image at its current clarity. A faded memory is genuinely less useful, so forgetting has consequences.

### Recall re-sharpens

When the agent uses a memory:

1. Clarity snaps back up to the ceiling. In the palace, the painting visibly comes back into focus.
2. The clock that erodes the ceiling resets to zero.
3. The recall count goes up, and every level's lifetime doubles (capped at 8×). Memories used repeatedly become durable, like spaced repetition.

Recall can restore clarity only up to the ceiling. A memory whose L0 and L1 are gone can never be seen at full resolution again.

```latex
\text{lifetime}_k = \text{base}_k \times \min\!\left(2^{\,r},\ 8\right) \qquad c(t) = c_0\, e^{-\lambda\, \Delta d / 2^{\,r}}
```

Here r is the recall count and Δd is simulated days since the last recall. The second formula is belief confidence, which decays more slowly the more a belief has been recalled.

### Beliefs outlive their screenshots

- A belief can keep high confidence after all its screenshots are gone. That's knowing a fact but forgetting where you learned it.
- A belief is forgotten when its confidence drops below 0.1 and no evidence remains.
- Human-sourced beliefs (voice notes, manual edits) decay at a quarter of the normal rate.

### Two clocks, one logic

- **Simulated clock (demo and evaluation).** A clock document in Atlas holds the current simulated day. Advancing it runs a forgetting sweep that deletes expired levels and decays beliefs. Fast-forward is just advancing the clock.
- **Real-time mode (production).** Each level document carries an `expires_at` date with a TTL index, and Atlas deletes it automatically. A recall pushes `expires_at` forward. The same rules, enforced by the database itself.

### Storage accounting

Every level stores its byte size. The evaluation sums bytes per condition per simulated day for the chart.

## Workflow learning

**After Maya does the same task twice, Loci writes down three things: the steps, the rules behind her choices, and how she sounds.** Every rule is checked against everything she actually did before it's trusted.

### Noticing a repeated workflow

After each episode, compare it with earlier episodes: same app, similar sequence of actions, similar summary. When two episodes match, they become a workflow candidate and the learner runs.

### What the learner produces

| Output | Example | Stored as |
| --- | --- | --- |
| Procedure | Open MockLoft → filter by price and area → for each listing: open it, check amenities, skip or message → send message | A procedure memory in the Housing room, with ordered steps and parameters |
| Decision rules | Budget ≤ $2,800; needs laundry; no walk-up above floor 3; near the L | Preference beliefs, each linked to the procedure step that uses it |
| Voice | Short, friendly, mentions a Sept 1 move-in, always asks about laundry | A style belief used when drafting messages |

### How rules are learned and checked

1. **Propose.** Give a model both episodes: every listing Maya saw, its attributes, and what she did with it. Ask for the simplest rules that explain her choices.
2. **Check.** Test every proposed rule in code against every decision from both runs. A rule contradicted by any decision is dropped.
3. **Score.** Confidence rises with the number of decisions a rule explains, and more for rules confirmed by a contrastive pair.
4. **Link.** Each surviving rule gets `derived_from` edges to the events that support it, and the procedure gets `uses` edges to the rules.

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
4. Return belief text and, when useful, the evidence screenshot at its current clarity.
5. Log the recall, which resets the memory's clock and re-sharpens it.

### Replaying a workflow

The agent runs the procedure in the browser with Playwright, using a small tool set:

- `open(url)`, `filter(price, area)`, `open_listing(id)`, `read_listing()`
- `skip(listing, because=[belief ids])`
- `message_landlord(listing, text)`

Every skip or message must cite the preference beliefs it relied on. Those citations drive the pulses in the palace and the re-sharpening.

Messages are drafted from the style belief, so they sound like Maya. They only ever go to the mock landlord chat.

### Learning from outcomes

If Maya or the presenter overrides a decision ("actually, message that one"), the override is logged as evidence against the rule that caused it. Its confidence drops; enough overrides and the rule is superseded.

## Voice notes and updates

**Speaking to Loci is the fastest way to change what it believes, and changes ripple to everything built on the old belief.**

### The path of a voice note

1. Hold to talk in the palace.
2. ElevenLabs speech-to-text returns a transcript.
3. Extraction runs on the transcript with the same schema as screenshots. Source is `voice`; starting confidence is 0.9.
4. Consolidation adds, updates, or removes beliefs.
5. Propagation finds and cracks everything that depended on what changed.

The transcript is kept as evidence. The audio itself isn't stored.

### Three kinds of update

| Say | What happens |
| --- | --- |
| "I'm getting a dog" | New fact, plus an **inferred** preference: pets allowed is now required. The inferred belief links to the voice note with a dashed thread, so it's visibly a conclusion rather than something Maya said |
| "My budget is now $3,000" | Conflicts with the existing budget belief. The old one is superseded, with history kept |
| "Forget the Bushwick place" | The matching beliefs are tombstoned and their screenshots deleted immediately |

### Propagation

When a preference changes, a `$graphLookup` over `uses` and `derived_from` edges finds every procedure that depends on it. Each one is marked **cracked**:

- The procedure's rule set is updated to include the change.
- In the palace, the procedure object shows cracks.
- The next successful run with the new rule heals the cracks and re-sharpens everything it used.

In the demo, this is beat 4: "I'm getting a dog," the apartment-hunt procedure cracks, and the re-run skips listings that don't allow pets.

## The palace and the agent's map

**Humans walk a 3D palace; the agent reads a compact 2D floor plan of the same memory.** Both are generated from the same Atlas data, so what you see is exactly what the agent knows.

### Layout

- A central atrium with doors to the semantic rooms: Housing, Work, Social, Health, Errands, Misc.
- Rooms grow with the number of memories inside.
- Inside a room, beliefs sit on pedestals, procedures sit on tables with their steps laid out as cards, and screenshots hang on the walls as paintings behind the beliefs they support.
- An Archive alcove off the atrium holds superseded beliefs in glass cases.

### What each visual means

| Visual | Meaning |
| --- | --- |
| Painting sharpness | The screenshot's current clarity |
| Empty frame labeled "forgotten" | Every level of that screenshot is gone |
| Glow | Belief confidence |
| Pulse and paintings snapping into focus | The agent just recalled this memory |
| Cracks | Depends on something that changed; needs a successful run to heal |
| Solid thread | Evidence: this belief came from that screenshot |
| Dashed thread | Inference: this belief was concluded, not seen |
| Gold frame | Came from Maya directly (voice note or edit) |

The empty frame is the image that sells the idea: Loci still knows the fact, but the moment it learned it is gone.

### Interactions

- Orbit camera; click a door to fly into a room.
- Click a belief to open its card: text, confidence over time, evidence thumbnails at current clarity, recall count, history, and Edit and Delete.
- Hold to talk for a voice note.
- A timeline scrubber sets the simulated day; fast-forward advances it and runs the forgetting sweep.
- A storage meter shows Loci's bytes against what keep-everything would have stored.

### Rendering

- React Three Fiber and drei; low-poly procedural geometry; instanced meshes for beliefs.
- Paintings use the sharpest stored level as a texture, with a blur shader set by clarity.
- Layout is computed deterministically from the data, so the same memory always builds the same palace.
- Atlas change streams arrive over WebSocket and animate the matching objects.

### The agent's 2D map

A small JSON floor plan the agent reads before recalling anything. It lists rooms, their top beliefs and procedures, and anything recently cracked. About 500 tokens, however large the memory grows.

```json
{
  "day": 24,
  "rooms": [
    { "name": "Housing", "beliefs": 41, "procedures": ["apartment_hunt"],
      "top": ["budget <= $2,800", "needs laundry", "no walk-up above floor 3", "near L train"],
      "cracked": [] },
    { "name": "Social", "beliefs": 17, "top": ["Priya's birthday dinner Oct 3"] }
  ]
}
```

## Data model

**Nine memory collections and three mock-world collections, all in the hackathon's Atlas sandbox cluster.** Every memory document carries a `condition` field so the three evaluation strategies share one cluster without mixing.

### Memory

```json
// captures: one per screenshot event
{ "_id", "condition": "loci|keep_all|blur_by_age", "episode_id", "day": 5,
  "actor": "maya|agent", "app": "mockloft", "url", "title",
  "action": { "type": "click", "text": "Reject", "bbox": [412, 88, 96, 32] },
  "page_text": "...", "phash": "c3a1...",
  "ceiling": "L1", "clarity": 0.62, "recalls": 2, "last_recall_day": 21 }

// image_levels: one document per rung of the ladder
{ "_id", "capture_id", "level": "L0|L1|L2|L3", "bytes": 184233,
  "data": BinData, "expires_day": 9, "expires_at": ISODate }

// beliefs
{ "_id", "condition", "triple": { "s": "Maya", "p": "requires", "o": "laundry" },
  "text": "Maya needs laundry in the unit or building",
  "kind": "fact|event|person|preference|routine|style", "room": "Housing",
  "confidence": 0.86, "recalls": 3, "last_recall_day": 24,
  "source": "screen|voice|agent_outcome", "inferred": false,
  "status": "active|cracked|superseded|tombstoned", "superseded_by": null,
  "evidence": ["capture ids"], "embedding": [...] }

// edges
{ "_id", "from", "to", "type": "derived_from|uses|evidence|supersedes", "weight": 1.0 }

// procedures
{ "_id", "name": "apartment_hunt", "room": "Housing", "status": "active|cracked",
  "steps": [ { "n": 1, "do": "open", "args": { "url": "/listings" } },
             { "n": 3, "do": "decide", "uses": ["belief ids"] } ],
  "learned_from": ["episode ids"], "runs": 1, "last_run_day": 24 }

// episodes, recalls, voice_notes, clock
{ "_id", "day": 2, "app": "mockloft", "summary": "...", "workflow": "apartment_hunt" }
{ "_id", "target": "belief or capture id", "day": 24, "by": "agent", "reason": "skip listing 311" }
{ "_id", "day": 25, "transcript": "I'm getting a dog", "beliefs": ["ids"] }
{ "_id": "clock", "day": 25, "mode": "simulated|realtime" }
```

### Mock world

- `listings`: price, neighborhood, train, floor, elevator, laundry, pets, photos, landlord, and which hunt it appears in.
- `messages`: inbox threads and landlord chat, including the agent's outgoing messages.
- `calendar_events`: Maya's month.

Full-resolution screenshots are a few hundred kilobytes, well under MongoDB's 16 MB document limit, so storing levels as `BinData` inside documents is fine. That's also what lets a TTL index delete them.

## How MongoDB Atlas is load-bearing

**Forgetting, propagation, the live palace and the agent's map are each implemented by an Atlas feature, not just stored in one.** Swap out the database and those behaviors have to be rebuilt.

| Atlas feature | What Loci uses it for | Why it matters |
| --- | --- | --- |
| TTL indexes | Deleting expired image levels in real-time mode; a recall pushes `expires_at` forward | The database itself does the forgetting |
| Change streams | Driving the live palace; triggering propagation when a belief changes | Every visual in the demo reacts to a real database event |
| `$graphLookup` | Finding every procedure and belief that depends on a changed belief; walking a belief back to its screenshots | This is how an update ripples |
| Atlas Vector Search | Near-duplicate beliefs, fallback recall, matching repeated workflows | Catches the same memory in different words |
| Aggregation pipeline | The agent's 2D map (group by room, rank by confidence, top N); the chart's bytes and accuracy per day | The map and the chart are queries, not code |
| Document model | A belief carries its triple, evidence, history and status together; image levels are small binary documents | Each rung of a memory is one deletable document |

Everything runs in the Atlas sandbox cluster provided for the hackathon, which finalists are required to use.

**First check before building on it:** confirm TTL indexes, change streams, vector search indexes and `$graphLookup` all work on the sandbox cluster.

## Sponsor technologies

**Loci uses all four technologies the hackathon names, each doing a real job rather than a logo placement.**

| Technology | Job in Loci | Where it shows in the demo |
| --- | --- | --- |
| MongoDB Atlas (sandbox cluster) | The entire memory: beliefs, image ladders, TTL forgetting, propagation, live updates | Everywhere; see the previous section |
| ElevenLabs speech-to-text | Voice notes become beliefs | Beat 4: "I'm getting a dog" |
| ElevenLabs text-to-speech | The dream journal: after each fast-forward, Loci says aloud what it kept and what it let go. Example: "I let 140 screenshots fade. I kept everything about your apartment search." | Beat 2 |
| LangSmith | Traces every extraction, learner and agent call. Each belief card links to the trace that created it. The evaluation runs as LangSmith experiments over a dataset of the \~50 questions, one experiment per memory strategy | Beat 5, and in Q&A: "why does it believe this?" |
| Vercel | Hosts the mock world and the palace; v0 scaffolds the mock apps' UI during the event | The link judges open |

The live server that holds change streams still runs outside Vercel's serverless functions, which can't keep a stream open. The palace on Vercel connects to it over WebSocket.

## Evaluation

**Two measurements: accuracy per byte of memory over 30 simulated days, and whether the agent's apartment decisions match Maya's.** Both compare Loci against baselines on identical inputs.

### Memory strategies compared

| Strategy | Screenshots | Beliefs | Recall effect |
| --- | --- | --- | --- |
| Keep everything | Full resolution forever | Never decay | None |
| Blur by age | Levels drop on a fixed age schedule | Decay by age | None |
| Loci | Levels drop, lifetime grows with use | Decay slows with use | Resets clock, restores clarity |

All three ingest the same captures and extractions, then diverge only in how they forget.

### Usage during the month

A scripted usage log (questions Maya asks, tasks she runs on certain days) is replayed identically for every strategy. Only Loci benefits from those recalls; that's the point being tested.

### Question set

About 50 questions with known answers, in three groups:

| Group | Examples | Expected result |
| --- | --- | --- |
| Used often | Budget, laundry, recurring design review, Priya's birthday | Loci matches keep-everything |
| Seen once, never needed again | A random listing's kitchen color, an old newsletter subject | Loci and blur-by-age both forget, by design |
| Rare but important | Lease signing date | Loci may forget unless Maya pins it by voice ("remember this") |

Report the overall score weighted by how often a real user would ask each group, and report each group separately. The third group is where Loci can lose, and the spec says so rather than hiding it.

### How accuracy is measured

- On days 5, 10, 15, 20, 25 and 30, an answering agent gets only that strategy's current memory: beliefs, plus screenshots at their current clarity.
- Answers are graded against the known answers: exact match where possible, a model judge otherwise.
- Bytes stored are summed per strategy on the same days.
- Tokens per answer are logged as a secondary number.

### The workflow measurement

For the agent's live hunt, compare its decisions with what Maya's true rules say:

- Correct skips and correct messages, as a count out of the listings shown.
- Against an agent with no memory, which has only the request.
- Before and after the voice note, to show the pets rule taking effect.

### The closing chart

Two stacked panels over simulated days: bytes stored on top, weighted accuracy below, one line per strategy. The workflow result sits beside it as a single line: "Loci: 10 of 10 decisions right. No memory: 4 of 10." (placeholder numbers until the runs are done).

## Work breakdown

**Everything that needs to exist for the full build, grouped by component.** The natural four-way split: mock world and capture; memory engine (extraction, forgetting, learning); agent and voice; palace and evaluation.

### Foundations

- [ ] Atlas sandbox project created from the hackathon invite link
- [ ] Confirm TTL indexes, change streams, vector search and `$graphLookup` on the sandbox
- [ ] Collections, indexes and a vector search index created
- [ ] Shared schema file every service imports
- [ ] Public repository with the team added

### Mock world

- [ ] Listings dataset of about 60 listings, including contrastive pairs and the four trap listings
- [ ] MockLoft: search, filters, listing pages with a Reject button and a message form
- [ ] Inbox and calendar views over seeded threads and events
- [ ] Canned landlord replies
- [ ] CC0 or generated photos

### Persona

- [ ] Maya's month as a script: hunts on days 2 and 5, ordinary life on days 3–20
- [ ] Playwright scripts that perform it with human-like pacing
- [ ] Ground-truth file: her true rules and the answers to every evaluation question
- [ ] Usage log: which questions she asks and tasks she runs on which days

### Capture

- [ ] Playwright hooks for load, click, submit and dwell
- [ ] Perceptual-hash dedupe
- [ ] Capture record with URL, app, action, bounding box, page text, actor, episode and day

### Ingest and extraction

- [ ] Resolution ladder generation (L0–L3) and storage as level documents
- [ ] Extraction prompt and strict JSON validation
- [ ] Room assignment from the fixed list
- [ ] Consolidation: exact match, vector match, conflict handling with supersede
- [ ] Episode summaries

### Forgetting engine

- [ ] Simulated clock document and advance endpoint
- [ ] Sweep: delete expired levels, update ceilings and clarity, decay beliefs
- [ ] Recall handler: restore clarity, reset clock, increment recalls, extend lifetimes
- [ ] Real-time mode with TTL indexes and `expires_at` updates
- [ ] Byte accounting per strategy per day

### Workflow learner

- [ ] Repeated-episode detection
- [ ] Rule proposal prompt
- [ ] Rule checker in code against every decision
- [ ] Procedure, preference and style beliefs written with `derived_from` and `uses` edges

### Agent

- [ ] Router: general, personal, workflow
- [ ] 2D map aggregation
- [ ] Recall tool with ranking and evidence at current clarity
- [ ] Replay tools over Playwright with mandatory belief citations
- [ ] Message drafting from the style belief
- [ ] Override handling as negative evidence

### Voice notes

- [ ] Hold-to-talk capture in the palace
- [ ] ElevenLabs speech-to-text
- [ ] Voice extraction, including inferred beliefs marked as inferred
- [ ] Propagation via `$graphLookup`, marking procedures cracked and healing on the next successful run

### Live server and palace

- [ ] Node server holding change streams, pushing over WebSocket
- [ ] Atrium and rooms laid out deterministically from data
- [ ] Beliefs, procedures, paintings with a clarity blur shader, empty "forgotten" frames
- [ ] Glow, pulse, cracks, solid and dashed threads, gold frames, Archive alcove
- [ ] Belief card with edit and delete
- [ ] Timeline scrubber, fast-forward, storage meter
- [ ] Split view with the browser, for the live hunt

### Evaluation

- [ ] Three strategies ingesting identical captures
- [ ] Usage log replayed per strategy
- [ ] Answering agent limited to each strategy's current memory; grader
- [ ] Runs on days 5, 10, 15, 20, 25, 30
- [ ] Workflow decision scoring against Maya's rules, with and without memory
- [ ] The two-panel chart, built from an aggregation

### Demo and submission

- [ ] Demo script for the five beats, rehearsed on the demo machine
- [ ] Pre-seeded demo database and a recorded fallback
- [ ] One-minute demo video for the submission form
- [ ] A closing note listing what was built at the event
- [ ] Repository confirmed public; all teammates on the submission

### Sponsor integrations

- [ ] ElevenLabs speech-to-text wired to hold-to-talk
- [ ] ElevenLabs text-to-speech dream journal, scripted from each forgetting sweep's stats (screenshots faded, beliefs kept, rooms that dimmed)
- [ ] LangSmith tracing wrapped around every Claude call and agent run
- [ ] `trace_url` stored on each belief and shown on its card
- [ ] LangSmith dataset of the evaluation questions; one experiment per strategy per checkpoint day
- [ ] Vercel projects for the mock world and the palace, pointing at the live server's WebSocket URL
- [ ] v0 used to scaffold the MockLoft, Inbox and Calendar UIs

## Risks and rule compliance

**The main risks are a flaky live browser run and judges filing this under "another Recall"; both have concrete answers.**

### Risks

| Risk | Mitigation |
| --- | --- |
| Live browser replay fails on stage | Mock site we control, fixed seed data, a pre-recorded fallback of the exact run |
| Extraction produces noisy or duplicate beliefs | Strict schema, fixed room list, consolidation by exact triple first |
| Learner infers the wrong rule | Contrastive pairs in the data; every rule checked in code against every decision |
| Judges see "another Recall" | Lead with forgetting and acting, not capturing: the chart and the live hunt are things Recall can't show |
| Judges see "basic RAG" | The demo's centerpiece is an agent acting in a browser and a memory that changes shape, not a Q&A box |
| Judges see "a dashboard" | The palace is interactive: voice notes, edits and deletes change what the agent does next |
| TTL deletion runs about once a minute | Real-time mode only; the demo and evaluation use the simulated clock |
| Change streams need a long-running process | A dedicated Node server, not serverless functions |
| Vision calls get expensive | Event-based capture and perceptual-hash dedupe keep the number of screenshots low |
| Private data on stage | Everything uses the Maya persona; no real accounts |

### Rule compliance

| Rule | How Loci meets it |
| --- | --- |
| Built in the Atlas sandbox cluster | Every collection lives there |
| Public repository | Public from the first commit |
| Up to four team members | Confirm the roster at registration |
| Demo shows only work built at the event | A closing note lists what was built; commit history starts at kickoff |
| No existing projects | New code only; earlier planning docs are not code |
| Rights to all code, data and assets | Our own mock sites, fictional persona and brands, CC0 or generated images |
| Not a banned project type | Not basic RAG, not an image analyzer, not a dashboard-first app, no Streamlit, no health or education framing |

## Open decisions

**Each has a default so nothing blocks; edit the default column to change it.**

| Decision | Default | Alternatives |
| --- | --- | --- |
| Level lifetimes (L0/L1/L2/L3) | 2 / 5 / 10 / 20 simulated days | Shorter, for a more dramatic fast-forward |
| Pinning ("remember this") | Supported by voice; pinned beliefs don't decay | No pinning, accepting losses on rare-but-important facts |
| Page text as an extraction hint | On | Screenshot only: purer, less accurate |
| Models | A fast model for extraction; a stronger one for the learner and the agent | One model everywhere |
| Approval before messaging landlords | Automatic in the demo | Ask Maya first, as in real use |
| Agent's own actions become memories | Yes | Only Maya's actions |
| Spoken dream journal (ElevenLabs text-to-speech) | On, after every fast-forward | Only at the end of the demo |
| Dream journal voice | A calm narrator voice from the ElevenLabs library | A voice designed for Loci |
| LangSmith | Tracing on every model call; evaluation as experiments | Tracing only |
| Full-Mac capture | Future work, mentioned in the pitch | In scope |
| Name | Loci | Fade, Palimpsest |

## Sources

- [DeepSeek-OCR: Contexts Optical Compression (arXiv 2510.18234)](https://arxiv.org/abs/2510.18234): about 97% text recovery at under 10× optical compression, about 60% at 20×; proposes progressively blurred images as a forgetting mechanism. The inspiration for fading screenshots.
- [Memory as Metabolism (arXiv 2604.12034)](https://arxiv.org/pdf/2604.12034): summarizes follow-up work contesting the optical-compression mechanism.
- [Screenpipe: Rewind alternative in 2026](https://screenpi.pe/blog/rewind-ai-alternative-2026): Meta acquired Limitless on December 5, 2025; Rewind's capture was disabled on December 19, 2025.
- [Screenpipe: personal AI memory in 2026](https://screenpipe.com/blog/personal-ai-memory-2026): landscape of always-on screen memory, including Microsoft Recall's privacy problems.
- [Google Codelabs: Survivor Network](https://codelabs.developers.google.com/codelabs/survivor-network/instructions): a 3D graph memory agent; inspired dashed inferred links. No code reused.
