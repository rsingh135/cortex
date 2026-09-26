import type { MascotBridge } from "../../shared/types";

async function call<T>(path: string, data?: unknown): Promise<T> {
  const response = await fetch(`/api/${path}`, {
    method: data === undefined ? "GET" : "POST",
    headers: { "x-cortex-client": "mascot", ...(data === undefined ? {} : { "content-type": "application/json" }) },
    ...(data === undefined ? {} : { body: JSON.stringify(data) }),
  });
  if (!response.headers.get("content-type")?.includes("application/json")) throw new Error("Start the Cortex companion server to use voice and memories in this preview.");
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? "Cortex could not complete the request.");
  return result as T;
}

/** Install the localhost transport only when Electron has not supplied its secure IPC bridge. */
export function connectBrowserCompanion(): void {
  if (window.mascot) return;
  const bridge: MascotBridge = {
    synthesize: async (text) => {
      const response = await fetch("/api/speech", { method: "POST", headers: { "x-cortex-client": "mascot", "content-type": "application/json" }, body: JSON.stringify({ text }) });
      if (!response.ok) {
        const result = await response.json() as { error?: string };
        throw new Error(result.error ?? "Emma’s voice could not be loaded.");
      }
      return new Uint8Array(await response.arrayBuffer());
    },
    realtimeToken: async () => (await call<{ token: string }>("realtime-token", {})).token,
    saveMemory: (text) => call("memories", { text }),
    listMemories: () => call("memories"),
    retryMemory: (id) => call("retry", { id }),
    ask: (text, opts) => call("ask", { text, ...opts }),
    transcribe: async (bytes, mime) => {
      const response = await fetch("/api/transcribe", { method: "POST", headers: { "x-cortex-client": "mascot", "content-type": mime }, body: new Blob([new Uint8Array(bytes)], { type: mime }) });
      if (!response.headers.get("content-type")?.includes("application/json")) throw new Error("Start the Cortex companion server to enable voice in the browser.");
      const result = await response.json() as { text?: string; error?: string };
      if (!response.ok || !result.text) throw new Error(result.error ?? "No speech detected. Try another recording.");
      return result.text;
    },
    setClickThrough: () => {},
    onEvent: () => () => {},
  };
  window.mascot = bridge;
}
