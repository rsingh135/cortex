# Palace architecture

The 3D memory palace and the agent's 2D map. Next.js 16 App Router, React Three Fiber 9, drei 10, three, zustand. Read `node_modules/next/dist/docs/` before touching routing. Bright architectural style: white plaster walls, pale wood floors, soft daylight, no bloom.

## Directories and ownership

| Dir | Owns | Depends on |
| --- | --- | --- |
| `src/lib/types.ts` | Palace view-model types (derived from `@cortex/schema`) | schema |
| `src/lib/layout.ts` | Deterministic layout: room placement, object slots, wall slots | types |
| `src/lib/fixtures/` | Seeded fake memory (`generate.ts`), canvas placeholder screenshots (`screens.ts`), fake event ticker (`ticker.ts`) | types, schema forgetting math |
| `src/lib/store.ts` | zustand store: state, `applyEvent`, `setDay` (sweep), `select`, `connect` | types, layout, fixtures |
| `src/lib/format.ts` | bytes, day, percent formatting | none |
| `src/scene/` | Canvas, lighting, architecture meshes, first-person controls, door fly, collision | store, layout |
| `src/objects/` | Belief pedestal, painting (blur shader), empty frame, procedure table, threads, cracks, archive case | store, layout |
| `src/hud/` | Belief card, timeline scrubber, storage meter, minimap, connection badge, help | store |
| `src/app/page.tsx` | Composes scene + objects + HUD (client-only Canvas via `next/dynamic`, `ssr: false`) | all |
| `src/app/map/page.tsx` | Standalone 2D map: floor plan + the JSON the agent reads | store, hud/minimap |

Rules: a dir imports only from `src/lib` and its own dir, except `page.tsx` files. No one edits `package.json`; deps are already installed. Every file that touches `window`, three, or R3F starts with `"use client"`.

## Units and coordinates

Meters, y up. Atrium is a regular hexagon-ish hall centred at the origin, radius 9. Six rooms sit at 60° increments (Housing 0°, Work 60°, Social 120°, Health 180°, Errands 240°, Misc 300°), door on the atrium edge, room centre at distance `9 + roomDepth/2 + 1.5` (a short doorway). Room footprint `w × d` = `clamp(8 + 0.6·sqrt(beliefs), 8, 18)` square. Archive alcove: a smaller room at 330°, distance 13, `6 × 6`. Wall height 4. Eye height 1.7.

`layout.ts` exports pure functions; given the memory snapshot it returns:

```ts
interface RoomLayout { room: Room; center: [number, number, number]; size: [number, number]; rotationY: number; door: [number, number, number] }
interface Placement { id: string; kind: "belief" | "procedure" | "painting" | "archive"; room: Room; position: [number, number, number]; rotationY: number }
interface PalaceLayout { atriumRadius: number; rooms: RoomLayout[]; archive: RoomLayout; placements: Map<string, Placement> }
computeLayout(snapshot: PalaceSnapshot): PalaceLayout
```

Placement is deterministic from `_id` (FNV-1a hash → slot index, stable across re-renders and reconnects). Beliefs on a grid of pedestals inside the room; procedures on tables along the back wall; paintings hang on the three non-door walls in wall slots, positioned behind the belief they support when possible; superseded beliefs go to archive cases.

## View model (`src/lib/types.ts`)

Derived from `@cortex/schema` documents plus the cortex-condition state, flattened for rendering:

```ts
interface PalaceBelief { id; text; kind; room; source; inferred; pinned; status; confidence; recalls; evidence: string[]; createdDay; history; ruleText?: string }
interface PalaceCapture { id; app; title; day; aliveLevels: Level[]; ceiling: Level | null; clarity; recalls; textureUrl: string | null }
interface PalaceProcedure { id; name; description; room; status; steps: {n; do; uses: string[]}[]; crackedBy: string[] }
interface PalaceEdge { id; from; to; type; }
interface PalaceSnapshot { day; beliefs: PalaceBelief[]; captures: PalaceCapture[]; procedures: PalaceProcedure[]; edges: PalaceEdge[]; bytes: { cortex: number; keepAll: number } }
```

## Store (`src/lib/store.ts`)

```ts
interface PalaceState {
  mode: "fixture" | "live";
  connection: "connecting" | "open" | "closed";
  snapshot: PalaceSnapshot;
  layout: PalaceLayout;                 // recomputed when snapshot membership changes
  selectedId: string | null;
  hoveredId: string | null;
  pulses: Record<string, number>;       // id -> timestamp of last recall pulse (ms)
  recentEvents: WsEvent[];              // last 50, for the HUD ticker
  controlsMode: "walk" | "orbit";
  playing: boolean;                     // fixture ticker running
  applyEvent(e: WsEvent): void;         // the single reducer for every live/fixture event
  setDay(day: number): void;            // fixture: runs a local sweep with @cortex/schema forgetting math; live: POST /clock/advance
  select(id: string | null): void; hover(id: string | null): void;
  editBelief(id, text): void; deleteBelief(id): void;   // fixture: local; live: engine call (stub)
  setControlsMode(m): void; setPlaying(b): void;
  connect(): void;                      // fixture: start ticker; live: open WS to NEXT_PUBLIC_LIVE_SERVER_WS_URL, GET /snapshot first
}
```

`applyEvent` handles every `WsEventType` from `@cortex/schema/events`. Unknown type → console.warn, no-op. `snapshot` event replaces state wholesale.

## Fixture mode (`src/lib/fixtures`)

Seeded PRNG (mulberry32, seed from `?seed=` or 42). Generates Maya's month at day 24: about 120 beliefs across all rooms (Housing heaviest, with the four learned preferences, a style belief, a pinned lease-date belief, one inferred pets belief with a dashed thread, three superseded budget beliefs for the archive), about 200 captures with `aliveLevels` computed from `@cortex/schema` forgetting math using the spec's usage-log recall days, two procedures (`apartment_hunt` active, one cracked), edges (`evidence`, `derived_from`, `uses`, `supersedes`). Bytes computed like `tools/simulate.ts`.

`screens.ts` draws placeholder screenshots on an offscreen canvas per capture (listing card, inbox rows, calendar grid, chat thread by `app`) at the ceiling level's resolution; returns a data URL. Real captures later supply a WebP URL through the same `textureUrl` field.

`ticker.ts` emits a plausible event every 1.5–4 s while `playing`: `belief.recalled` + `capture.recalled` cascades, `level.deleted`, `belief.reinforced`, an occasional `procedure.cracked` then `procedure.healed`. Deterministic sequence from the seed.

## Visual mapping

| State | Visual |
| --- | --- |
| Belief confidence | Object opacity 0.35 → 1 and saturation; low confidence sinks 10 cm into the pedestal |
| Belief kind | Shape: fact = cube, event = flat disc, person = capsule, preference = octahedron, routine = ring, style = cone, summary = slab |
| Recall pulse | Scale bump 1 → 1.25 → 1 over 600 ms, brief warm rim light; painting snaps sharp |
| Capture clarity | Painting blur shader radius ∝ (1 − clarity); texture is the ceiling level |
| Forgotten capture | Empty frame with a small "forgotten" plaque |
| Cracked procedure | Table shows crack decals and a red hairline; heals with a fade |
| Threads | Evidence: solid thin line belief → painting; derived_from / uses: solid between objects; inferred: dashed |
| Source voice/manual or pinned | Gold frame or gold pedestal trim |
| Superseded | Glass case in the Archive alcove |

## Controls

First-person: pointer lock on click of the canvas, WASD + mouse look, shift to run, `E` or click a door to fly through it (camera tween 700 ms, ends inside the room facing its centre). Collision: AABB against room and atrium walls; doors are gaps. `Tab` toggles orbit mode (drei `OrbitControls`). `Esc` releases pointer. Click an object → `select(id)`; the HUD shows the card. Touch devices default to orbit.

## HUD

Top-left: connection badge (fixture / live), day, storage meter (cortex bytes vs keep-everything as two bars + percentage). Bottom: timeline scrubber day 1–30 with checkpoint ticks, play/pause for the ticker, fast-forward button (advances 1 day per 400 ms with the sweep animating). Right: belief card when selected (text, kind, room, confidence bar and history sparkline, recall count, evidence thumbnails at current clarity, gold badge, Edit / Delete). Top-right: minimap (2D floor plan, you-are-here dot, click a room to fly). `/map` page: the same floor plan large, plus a `<pre>` of the agent's map JSON (rooms, counts, top beliefs, cracked, recent_changes) built from the snapshot by `src/lib/map.ts`.

## Testing

vitest, node environment, `src/lib/**/*.test.ts`: layout determinism and no overlaps, fixture generator invariants (every edge endpoint exists, every capture referenced by a belief exists, alive levels match forgetting math), store reducer for each event type, map JSON shape. Scene/HUD are verified by `next build` + a Playwright smoke screenshot.
