# Cortex

A memory for your computer that remembers what you use, lets the rest fade, and then does your chores the way you would. Screenshots become beliefs; beliefs fade unless used; used memories drive an agent that replays your workflows with your preferences.

Built during the MongoDB Atlas hackathon (Statement Two, Long Horizon Engineering). Everything in this repository was created during the event. Design: [docs/spec.md](docs/spec.md). Interfaces: [docs/contracts.md](docs/contracts.md). Brief: [docs/brief.md](docs/brief.md).

## Layout

| Path | What |
| --- | --- |
| `apps/mockworld` | Next.js. Maya's listings site, inbox, calendar, landlord chat. Deployed to Vercel. |
| `apps/palace` | Next.js + React Three Fiber. The 3D memory palace and the agent's 2D map. Deployed to Vercel. |
| `apps/mascot` | Electron + React. The Cortex mascot: a desktop pet that listens, talks through ElevenLabs, and answers from the real memory via the engine's `POST /ask`. |
| `apps/engine` | One long-running Node process: ingest, extraction, forgetting, workflow learner, agent, voice, change-stream live server, evaluation. |
| `packages/schema` | zod schemas, enums, forgetting math, rule DSL and checker, WebSocket events, API types. Imported everywhere. |
| `packages/persona` | Maya's month: listings, script, ground truth, questions, usage log. |
| `tools/` | `simulate.ts`, `atlas-check.ts`, `reset-demo-db.ts`. |

## Tracks

Three people, three tracks: palace (`apps/palace`), memory engine (`apps/engine`, `packages/persona`), mascot (`apps/mascot`). Ownership, branch names and the contract-change rule are in [CONTRIBUTING.md](CONTRIBUTING.md).

## Setup

```bash
pnpm install
cp .env.example .env   # fill in ATLAS_URI, ANTHROPIC_API_KEY, VOYAGE_API_KEY, ELEVENLABS_API_KEY, LANGSMITH_API_KEY
```

Requires Node 24+ and pnpm 12.

## Verify

```bash
pnpm typecheck      # every package and the tools
pnpm test           # schema, persona, engine, and simulator tests
pnpm simulate       # forgetting simulator: bytes per day per strategy plus the demo-beat assertions
pnpm atlas:check    # proves change streams, TTL, $graphLookup and Vector Search work on the sandbox
```

## Run

```bash
pnpm --filter @cortex/engine dev
pnpm --filter @cortex/mockworld dev
pnpm --filter @cortex/palace dev
pnpm --filter @cortex/mascot dev
```

Deploys to Vercel go through the GitHub integration, not the CLI.
