# Cortex mascot

**Track:** mascot. A desktop pet that sits at the top of your screen, talks with ElevenLabs, and answers questions from Maya's real memory.

## How it works

The mascot is a thin client. Every answer comes from the engine's `POST /ask` (`AskRequest` / `AskResponse` in `packages/schema/src/api.ts`): the engine routes the question, recalls beliefs, calls Claude, traces to LangSmith, and optionally returns `audio_url` for the spoken answer. Cited beliefs pulse in the palace because the recall is logged there. The mascot never holds an Anthropic key. The main process also subscribes to the engine's `/ws` feed and forwards `belief.recalled`, `belief.forgotten`, `clock.advanced` and `voice.received` so the pet nods when a memory is used and shivers when one is forgotten.

```
renderer (React)  --ipc-->  main (Electron)  --http POST /ask-->  apps/engine
      ^                        |
      +---- forwarded events --+--- ws /ws ------------------------ apps/engine
```

| Path | What |
| --- | --- |
| `src/main/index.ts` | Frameless transparent always-on-top window at top-center, tray with Quit, `/ask` bridge, WebSocket relay with backoff |
| `src/preload/index.ts` | `window.mascot` bridge: `ask`, `setClickThrough`, `onEvent` |
| `src/renderer/` | `App`, `Pet` (states idle / listening / thinking / speaking / reacting), `Bubble`, `Composer` (text + hold-to-talk), `lib/store` (pure reducer + zustand), `lib/stt` (ElevenLabs stub), `lib/tts` (plays `audio_url`) |
| `src/shared/types.ts` | IPC channel names and the `window.mascot` type |
| `test/` | Reducer tests |

## Run

```bash
pnpm install                                   # from the repo root
pnpm --filter @cortex/engine dev               # the engine must be up for answers
pnpm --filter @cortex/mascot dev               # opens the pet window
pnpm --filter @cortex/mascot typecheck && pnpm --filter @cortex/mascot test && pnpm --filter @cortex/mascot build
```

Environment (main process reads these; none required for local dev):

| Var | Default | Use |
| --- | --- | --- |
| `ENGINE_HTTP_URL` | `http://localhost:4000` | `POST /ask` |
| `ENGINE_WS_URL` | `ws://localhost:4000/ws` | Event relay |
| `VITE_ELEVENLABS_API_KEY` | unset | Renderer-side speech-to-text only (`src/renderer/lib/stt.ts`). Answer speech comes from the engine |

macOS needs no code signing for local dev. The window hides from the Dock and lives in the tray; hover the pet to interact, move away and clicks pass through to the desktop.

## Build first

1. Persona: the pet's voice and personality live in the engine's `/ask` prompt for `client: "mascot"`; coordinate with the engine track on tone and length.
2. Animations: replace the placeholder blob in `Pet.tsx`; keep the five states and the two reactions.
3. Speech-to-text: implement `transcribe()` in `lib/stt.ts` with ElevenLabs Scribe, then remove the "not wired yet" path in `Composer.tsx`.
4. Tray icon: add `resources/tray.png` (16x16 + @2x) and load it in `createTray()`.
5. Demo hooks: a "what did I forget today?" quick action that calls `/ask` after each fast-forward.
