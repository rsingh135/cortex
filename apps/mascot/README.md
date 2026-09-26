# Cortex brain companion

Track three: a small pink brain with glasses and short legs, living above other desktop windows. Click the character to open a memory card; click again to collapse. Drag Cortex herself to move her; a short click opens her card. She starts in the bottom-right corner. Transparent areas pass clicks through to the apps below. The tray offers Show, Hide, and Quit. Idle, listening, thinking, speaking, recall, and forgetting have distinct animations; reduced-motion preferences are respected.

## Run

From the repository root, with Node 24+ and pnpm 12:

```sh
pnpm install
cp .env.example .env
pnpm --filter @cortex/mascot dev
```

The mascot reads the repository `.env` or `apps/mascot/.env`. Existing environment variables take precedence.

| Variable | Purpose |
| --- | --- |
| `ENGINE_HTTP_URL` | Engine HTTP URL; defaults to `http://localhost:4000` |
| `ENGINE_WS_URL` | Engine events URL; defaults to `ws://localhost:4000/ws` |
| `ELEVENLABS_API_KEY` | Enables ElevenLabs Scribe v2 Realtime voice transcription |

No credential is included in the renderer. Do **not** use a `VITE_` prefixed API key. Scribe streams microphone audio to ElevenLabs while recording; live partial transcripts appear immediately in the editor. The main process or local server issues a short-lived single-use token, so the API key never reaches the renderer. Microphone access requires macOS permission. Recordings stop after 60 seconds; audio tracks are released on stop, failure, cancellation, or panel unmount. Stop recording commits the last words and makes the live transcript editable for review before sending. Optional spoken replies are synthesized server-side using the selected ElevenLabs Emma voice.

## Memories and engine integration

- **Add a memory** sends text or a reviewed live voice transcript through the existing `POST /voice` contract.
- The current engine implementation returns HTTP 501 for `/voice`. The mascot therefore keeps a durable local notebook at Electron's `app.getPath("userData")/memories.json` before attempting delivery. This is local JSON, not encrypted storage.
- A memory says **Added to Cortex** only after a valid `VoiceResponse`. Offline, unsupported, timeout, and invalid responses leave it **On this device · delivery unconfirmed**. Pending notes survive restart and have an explicit Retry button. No silent background retry.
- The contract has no idempotency key. If the engine processed a request but its acknowledgment was lost, Retry can duplicate it. Coordinate idempotency with the engine track before automatic synchronization.
- The recent list shows the latest 20 notes; the local notebook retains all notes. Pending local notes are not searchable by `/ask` until delivered to the engine.
- **Ask Cortex** uses `POST /ask` and optionally speaks the answer in the selected voice. No mock answers or fabricated save confirmations.

## Verify

```sh
pnpm --filter @cortex/mascot typecheck
pnpm --filter @cortex/mascot test
pnpm --filter @cortex/mascot build
```

Tests cover conversation reactions, durable offline capture, concurrent writes, restart recovery, explicit retries, response validation, and ElevenLabs multipart requests/errors. Live speech and engine ingestion need working credentials/services.

Manual desktop check: open the app, click the brain, type a memory, verify its local/engine status, restart and check persistence, record and stop a voice note, review/edit before sending, drag the footer, and verify clicks outside visible controls reach the window underneath.

## Browser companion and voice

The browser preview now has a local service bridge, so voice and memory capture work without Electron IPC. Start it after building:

```sh
pnpm --filter @cortex/mascot build
pnpm --filter @cortex/mascot preview:web
```

Open `http://127.0.0.1:5173`. A plain static file server cannot provide transcription. The companion server reads the same `.env`, keeps the ElevenLabs key server-side, restricts requests to its local origin, and stores the browser notebook in git-ignored `apps/mascot/.local/memories.json`. The desktop notebook remains in Electron userData. The browser does not relay live engine reaction events.

Click **Use voice**, allow microphone access when prompted, and watch words appear as you speak. Click **Stop recording** to finalize the text. Review the transcript and choose **Keep memory**. Permission, missing-device, busy-microphone, and empty-recording errors are shown explicitly. The server and desktop share the same Scribe transcription implementation.

## Reference-based 3D character and live speech

Realtime voice uses `scribe_v2_realtime` over WebSocket, 16 kHz mono PCM16 from an AudioWorklet, partial transcript replacement, and explicit final commit on Stop. On failure, the words already displayed remain available for editing. No automatic save or send. Microphone tracks, audio nodes, websocket, and timers are released on stop/failure; recordings stop after 60 seconds. The checked-in worklet is loaded from the app's own origin under the existing CSP.

Tests cover bounded cursor tracking, voice selection, billing errors, realtime transcripts, recording lifecycle, conversation state and durable memory capture.

Protocol: https://elevenlabs.io/docs/api-reference/speech-to-text/v-1-speech-to-text-realtime

### Cortex's character

Cortex uses a front-facing reference-based, transparent 3D-rendered portrait (`cortex-front.png`) at 120 × 120 CSS pixels. Her original appearance is preserved, with a gentle perspective tilt toward the pointer. This is a rendered image with parallax, not a live 3D mesh. Browser tracking covers the whole window; Electron forwards desktop cursor coordinates so she responds outside her transparent window too. Reduced-motion preferences disable the tilt and idle animation. Event handlers, IPC subscriptions and the animation loop are released on unmount.

The optional **Talk with Cortex** switch enables spoken greetings and replies, using ElevenLabs Emma (`56bWURjYFHyYyVf490Dp`). Switching it off cancels playback, including speech requests still in flight. This library voice requires a paid ElevenLabs API plan; the current account returned `402 paid_plan_required`. Credentials stay in the main process/local server. Voice input remains available separately and transcribes live for review before sending.
