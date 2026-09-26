# Demo runbook

Three minutes, five beats, one laptop. Everything below assumes the engine, mock world and palace run locally and the palace is open full-screen on the projector with the browser window for the live hunt on the second half of the screen.

## Building the day-24 snapshot (once, or after the engine changes)

```bash
pnpm --filter @cortex/mockworld build && pnpm --filter @cortex/mockworld start -p 3222   # fresh process: reject state is in memory
ATLAS_DB=cortex_demo pnpm --filter @cortex/engine start                                  # port 4000
MOCKWORLD_URL=http://localhost:3222 pnpm play-maya --speed 0 --engine http://localhost:4000 --usage-log
curl -X POST localhost:4000/clock/advance -H 'content-type: application/json' -d '{"to_day":24}'
ATLAS_DB=cortex_demo pnpm reset-demo-db --save snapshots/day24
```

`--usage-log` advances the clock day by day and replays Maya's questions as recalls, so the housing memories she used stay sharp while the rest fade. Restart the mock world before every run: it keeps reject state in memory and the runner skips listings whose Reject button is gone.

## Before going on stage

```bash
pnpm reset-demo-db --restore snapshots/day24 --yes     # known state: Maya's month ingested, clock at day 24
pnpm --filter @cortex/mockworld start -p 3000
pnpm --filter @cortex/engine start                     # port 4000, Atlas mode
pnpm --filter @cortex/palace start -p 3001             # built with NEXT_PUBLIC_LIVE_SERVER_WS_URL=ws://localhost:4000/ws
pnpm --filter @cortex/mascot dev                       # optional: pet on top of the screen
```

Checklist:
- Phone hotspot tested; Atlas and the model APIs reachable.
- `snapshots/day24` restored and the palace shows Day 24 with the Housing room full.
- Pre-generated audio in `apps/palace/public/demo/`: `dream-journal.mp3`, `voice-dog.wav`.
- Recorded fallback video of the whole run in `apps/palace/public/demo/fallback.mp4`.
- Browser zoom 100%, palace at 1920x1080, walk mode, spawn facing the Housing door.
- Rehearsed twice from the restore command.

## The beats

| # | Beat | Do | Say | Palace hotkey |
| --- | --- | --- | --- | --- |
| 1 | Memory forms | Press `R`: replay of the day-2 hunt's ingest events on a timer, then the last five captures extracted live from the runner | "Maya browsed apartments. Each screenshot becomes a belief in the Housing room." | `R` replay, `Shift+R` stop |
| 2 | Memory fades | Click fast-forward to day 24 | "Three weeks pass. What she never used blurs and vanishes. What she kept returning to stays sharp." Play the dream journal once at the end of the sweep | `J` dream journal |
| 3 | Memory acts | Type "Find me apartments" in the mascot or the palace composer. The palace opens its browser split view (`B`) with MockLoft; the agent reads six listings, skips four, drafts two messages. The draft card appears; approve each or press `A` | "It skips the walk-up, the one without laundry, the one over budget, the one off the L. Every rule it used just pulsed." | `A` approve all drafts |
| 4 | Memory updates | Hold to talk, say "I'm getting a dog" (or `V` for the pre-recorded WAV). The pets belief appears with a dashed thread; the procedure cracks. Re-run the hunt on the four re-run listings | "One sentence, and everything built on the old belief follows." | `V` voice fallback |
| 5 | The proof | Open `/chart` | "Cortex keeps keep-everything's accuracy at a fraction of the storage. Six of six decisions right; no memory gets two." | `C` chart |

Rehearsing beat 3 without the engine: open `/palace?demo=drafts` and the sample approval card appears after two seconds.

Closing line: **Recall remembers everything. Cortex remembers you.**

## If something breaks

| Symptom | Do |
| --- | --- |
| Engine unreachable | Palace shows FIXTURE mode automatically when the socket fails; press `R` anyway, the replay runs from the bundled event log. Say the same words. |
| Agent stalls > 20 s in beat 3 | Press `F`: recorded action log replays through the same browser UI. |
| Mic fails in beat 4 | `V` sends the pre-recorded WAV through the same speech-to-text path; text composer as the last resort. |
| Palace WebGL dies | `F` plays `fallback.mp4` full-screen from the current beat. |
| Wi-Fi dies | Hotspot. If Atlas is still unreachable, fixture mode plus `F` for beats 3 and 4. |

## Timing budget

| Beat | Seconds |
| --- | --- |
| 1 | 35 |
| 2 | 30 |
| 3 | 60 |
| 4 | 35 |
| 5 | 20 |
| Total | 180 |

## Rule compliance on stage

Say once, at the start: "Everything you see was built this weekend; the repo is public and the commit history starts at kickoff." The closing note in the README lists what was built.
