import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { LiveTranscript, streamSpeech } from "../src/renderer/lib/realtime";
import { createRealtimeToken } from "../src/main/transcribe";

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.useRealTimers(); });

describe("live transcripts", () => {
  it("replaces interim guesses without duplicating the final sentence", () => {
    const text = new LiveTranscript();
    expect(text.update("partial_transcript", "I like ca")).toBe("I like ca");
    expect(text.update("partial_transcript", "I like cafes")).toBe("I like cafes");
    expect(text.update("committed_transcript", "I like cafés.")).toBe("I like cafés.");
    expect(text.update("partial_transcript", "Quiet ones")).toBe("I like cafés. Quiet ones");
  });
  it("issues single-use tokens without returning the long-lived key", async () => {
    vi.stubEnv("ELEVENLABS_API_KEY", "private-key");
    const fetch = vi.fn().mockResolvedValue(Response.json({ token: "one-use-token" }));
    vi.stubGlobal("fetch", fetch);
    expect(await createRealtimeToken()).toBe("one-use-token");
    expect(fetch.mock.calls[0]![0]).toContain("single-use-token/realtime_scribe");
  });
  it("surfaces token permission errors", async () => {
    vi.stubEnv("ELEVENLABS_API_KEY", "private-key");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 401 })));
    await expect(createRealtimeToken()).rejects.toThrow("Speech to Text permissions");
  });
});

describe("streaming audio", () => {
  it("shows words before Stop, commits the ending, and releases every resource", async () => {
    vi.useFakeTimers();
    const stop = vi.fn(), close = vi.fn(), disconnect = vi.fn();
    vi.stubGlobal("navigator", { mediaDevices: { getUserMedia: async () => ({ getTracks: () => [{ stop }] }) } });
    vi.stubGlobal("document", { baseURI: "http://127.0.0.1:5173/" });
    vi.stubGlobal("window", { mascot: { realtimeToken: async () => "test-token" } });
    class Context {
      state = "running";
      audioWorklet = { addModule: async () => {} };
      destination = {};
      resume = async () => {};
      close = close.mockResolvedValue(undefined);
      createMediaStreamSource = () => ({ connect: vi.fn(), disconnect });
      createGain = () => ({ gain: { value: 1 }, connect: vi.fn(), disconnect });
    }
    class Worklet {
      connect = vi.fn(); disconnect = disconnect;
      port = { onmessage: null as null | ((event: unknown) => void), postMessage: () => { this.port.onmessage?.({ data: { bytes: new ArrayBuffer(2048) } }); this.port.onmessage?.({ data: { flushed: true } }); } };
    }
    class Socket {
      static OPEN = 1;
      readyState = 1; bufferedAmount = 0;
      onmessage: null | ((event: { data: string }) => void) = null;
      onclose = null; onerror = null;
      constructor() { queueMicrotask(() => this.emit({ message_type: "session_started" })); }
      emit(value: unknown) { this.onmessage?.({ data: JSON.stringify(value) }); }
      send(message: string) { if (JSON.parse(message).commit) queueMicrotask(() => this.emit({ message_type: "committed_transcript", text: "I like cafés." })); }
      close = vi.fn();
    }
    vi.stubGlobal("AudioContext", Context); vi.stubGlobal("AudioWorkletNode", Worklet);
    let socket: Socket;
    vi.stubGlobal("WebSocket", class extends Socket { constructor() { super(); socket = this; } });
    let active = true;
    const update = vi.fn(), phase = vi.fn();
    const done = streamSpeech(() => active, update, phase);
    await vi.advanceTimersByTimeAsync(1);
    socket!.emit({ message_type: "partial_transcript", text: "I like ca" });
    expect(active).toBe(true);
    expect(update).toHaveBeenLastCalledWith("I like ca");
    active = false;
    await vi.advanceTimersByTimeAsync(100);
    await done;
    expect(update).toHaveBeenLastCalledWith("I like cafés.");
    expect(phase.mock.calls.map(([value]) => value)).toEqual(["connecting", "listening", "finishing"]);
    expect(stop).toHaveBeenCalled(); expect(close).toHaveBeenCalledOnce(); expect(disconnect).toHaveBeenCalled();
  });
  it("encodes clamped little-endian PCM16 and flushes the last short packet", () => {
    const packets: Array<{ bytes?: ArrayBuffer; flushed?: boolean }> = [];
    let Processor: new () => { process(inputs: number[][][]): void; port: { onmessage(): void } };
    runInNewContext(readFileSync(new URL("../src/renderer/public/pcm-worklet.js", import.meta.url), "utf8"), {
      AudioWorkletProcessor: class { port = { postMessage: (data: typeof packets[number]) => packets.push(data), onmessage: null }; },
      registerProcessor: (_name: string, value: typeof Processor) => { Processor = value; },
    });
    const worklet = new Processor!(); worklet.process([[[-2, 0, 2]]]); worklet.port.onmessage();
    const pcm = new DataView(packets[0]!.bytes!);
    expect([pcm.getInt16(0, true), pcm.getInt16(2, true), pcm.getInt16(4, true)]).toEqual([-32768, 0, 32767]);
    expect(packets[1]).toEqual({ flushed: true });
  });
});
