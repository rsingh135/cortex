# Working in this repo

Three people, three tracks, one trunk. The goal is zero merge conflicts: each track owns its directories, and the only shared surface is `packages/schema` plus `docs/contracts.md`.

## Tracks and ownership

| Track | Owns | Talks to others through |
| --- | --- | --- |
| Palace (3D / 2D visualization) | `apps/palace` | Reads `GET /snapshot`, `/ws` events, `POST /recall`, `/clock/advance`, `/ask` from the engine. Fixture mode needs nothing running. |
| Memory engine | `apps/engine`, `packages/persona` | Serves every endpoint in `docs/contracts.md`; owns Mongo, capture policy, ladder, forgetting, search, agent, voice. |
| Mascot | `apps/mascot` | Calls `POST /ask` and listens on `/ws`. Never holds an Anthropic key. |
| Shared | `packages/schema`, `docs/contracts.md`, `docs/spec.md` | Change by PR with a reviewer from another track. |

`apps/mockworld` and `tools/` are unowned until someone picks them up; say so in the team chat before you start.

## Branches and PRs

- `main` is always green. Never commit to it directly.
- Branch names: `palace/<thing>`, `engine/<thing>`, `mascot/<thing>`, `shared/<thing>`.
- Keep branches under a day old. Rebase on `main` before opening the PR: `git fetch origin && git rebase origin/main`.
- Open a PR, let CI pass, get the owner's review for any file outside your track, squash-merge.
- Commit messages: `type(scope): imperative summary`, e.g. `feat(palace): blur shader on paintings`, `fix(engine): phash distance off by one`. Types: feat, fix, docs, chore, test, refactor.

## Changing a contract

1. Edit the zod schema in `packages/schema/src`.
2. Update `docs/contracts.md` in the same PR.
3. Run `pnpm typecheck` from the root; every app compiles against the new shape.
4. Request review from the other two tracks. Merge only when both apps that consume the type have been updated or have agreed to follow up.

## Daily loop

```bash
git fetch origin && git rebase origin/main   # start of session
pnpm install                                 # when the lockfile changed
pnpm --filter @cortex/<app> dev              # your app
pnpm typecheck && pnpm lint && pnpm test     # before pushing
```

## Keys and environment

`.env` is git-ignored. Copy `.env.example`, fill only what your track needs. The engine needs Atlas, Anthropic, Voyage, ElevenLabs, LangSmith. The palace needs nothing in fixture mode. The mascot needs `ENGINE_HTTP_URL` and, for local speech-to-text, `ELEVENLABS_API_KEY`.

## Running against each other

- Engine in fixture mode: `FIXTURE_MODE=true pnpm --filter @cortex/engine dev` serves `/health` and an empty `/snapshot` with no database, so the palace and mascot can hit real endpoints before the memory exists.
- Palace: `pnpm --filter @cortex/palace dev`, then `http://localhost:3000` (fixture mode) or set `NEXT_PUBLIC_LIVE_SERVER_WS_URL` for live.
- Mascot: `pnpm --filter @cortex/mascot dev` with `ENGINE_HTTP_URL` pointing at the engine.
