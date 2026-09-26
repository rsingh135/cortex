import { synthesizeSpeech } from "./speech";
/** Local browser companion: same service implementations as Electron, no key in the client. */
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { AskRequest, AskResponse } from "@cortex/schema";
import { MemoryNotebook } from "./memory";
import { transcribeAudio, createRealtimeToken } from "./transcribe";

const appRoot = fileURLToPath(new URL("../../", import.meta.url));
for (const path of [resolve(appRoot, ".env"), resolve(appRoot, "../../.env")]) if (existsSync(path)) process.loadEnvFile(path);
const port = Number(process.env.MASCOT_PREVIEW_PORT ?? 5173);
const origin = `http://127.0.0.1:${port}`;
const engine = process.env.ENGINE_HTTP_URL ?? "http://localhost:4000";
const notebook = new MemoryNotebook(resolve(appRoot, ".local/memories.json"), engine);
const root = resolve(appRoot, "out/renderer");
const types: Record<string, string> = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png" };

createServer(async (request, response) => {
  const json = (status: number, body: unknown) => {
    response.writeHead(status, { "content-type": "application/json", "cache-control": "no-store" });
    response.end(JSON.stringify(body));
  };
  // Prevent other websites from invoking local privileged actions or reading memories.
  if (request.headers.host !== `127.0.0.1:${port}`) { json(403, { error: "Invalid host." }); return; }
  const url = new URL(request.url ?? "/", origin);
  try {
    if (url.pathname.startsWith("/api/")) {
      if (request.headers["x-cortex-client"] !== "mascot" || (request.headers.origin && request.headers.origin !== origin)) {
        json(403, { error: "Open the companion at its local address." }); return;
      }
      if (url.pathname === "/api/memories" && request.method === "GET") { json(200, await notebook.list()); return; }
      if (request.method !== "POST") { json(405, { error: "Method not allowed." }); return; }
      if (url.pathname === "/api/realtime-token") { json(200, { token: await createRealtimeToken() }); return; }
      const chunks: Buffer[] = []; let size = 0;
      for await (const chunk of request) {
        size += chunk.length;
        if (size > 20 * 1024 * 1024) { json(413, { error: "Recording is too large. Try a shorter note." }); return; }
        chunks.push(Buffer.from(chunk));
      }
      const body = Buffer.concat(chunks);
      if (url.pathname === "/api/transcribe") {
        json(200, { text: await transcribeAudio(new Uint8Array(body), request.headers["content-type"] ?? "") }); return;
      }
      const data = JSON.parse(body.toString()) as { text?: unknown; id?: unknown; speak?: boolean };
      if (url.pathname === "/api/speech" && typeof data.text === "string") {
        const bytes = await synthesizeSpeech(data.text);
        response.writeHead(200, { "content-type": "audio/mpeg", "cache-control": "no-store" }); response.end(bytes); return;
      }
      if (url.pathname === "/api/memories" && typeof data.text === "string") { json(200, await notebook.save(data.text)); return; }
      if (url.pathname === "/api/retry" && typeof data.id === "string") { json(200, await notebook.retry(data.id)); return; }
      if (url.pathname === "/api/ask") {
        const payload = AskRequest.parse({ text: data.text, client: "mascot", speak: data.speak === true });
        const result = await fetch(`${engine}/ask`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload), signal: AbortSignal.timeout(60000) });
        if (!result.ok) throw new Error("The memory engine is unavailable. You can still add a memory locally.");
        json(200, AskResponse.parse(await result.json())); return;
      }
      json(400, { error: "Invalid request." }); return;
    }
    const path = resolve(root, `.${decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname)}`);
    if (!path.startsWith(`${root}/`) || !(await stat(path)).isFile()) { response.writeHead(404); response.end(); return; }
    response.writeHead(200, { "content-type": types[extname(path)] ?? "application/octet-stream", "cache-control": "no-store" });
    response.end(await readFile(path));
  } catch (error) { json(400, { error: error instanceof Error ? error.message : "Request failed." }); }
}).listen(port, "127.0.0.1", () => console.log(`Cortex companion: ${origin}`));
