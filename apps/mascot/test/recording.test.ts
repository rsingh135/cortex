import { afterEach, describe, expect, it, vi } from "vitest";
import { recordWhile, transcribe } from "../src/renderer/lib/stt";

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
function microphone() {
  const stop = vi.fn();
  vi.stubGlobal("navigator", { mediaDevices: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [{ stop }] }) } });
  return stop;
}
class Recorder {
  static isTypeSupported = (type: string) => type === "audio/webm";
  state = "inactive";
  mimeType = "audio/webm";
  ondataavailable?: (event: { data: Blob }) => void;
  onstop?: () => void;
  start() { this.state = "recording"; }
  stop() { this.state = "inactive"; this.ondataavailable?.({ data: new Blob(["audio"]) }); this.onstop?.(); }
}
describe("microphone lifecycle", () => {
  it("stops and releases the microphone, returning actual recorded audio", async () => {
    vi.useFakeTimers(); const stop = microphone(); vi.stubGlobal("MediaRecorder", Recorder);
    let active = true;
    const result = recordWhile(() => active);
    await vi.advanceTimersByTimeAsync(1);
    active = false;
    await vi.advanceTimersByTimeAsync(100);
    expect((await result).size).toBe(5);
    expect(stop).toHaveBeenCalledOnce();
  });
  it("releases permission-delayed streams when recording was cancelled", async () => {
    const stop = microphone(); vi.stubGlobal("MediaRecorder", Recorder);
    await expect(recordWhile(() => false)).rejects.toThrow("cancelled");
    expect(stop).toHaveBeenCalledOnce();
  });
  it("releases tracks when recorder construction fails", async () => {
    const stop = microphone();
    vi.stubGlobal("MediaRecorder", class extends Recorder { constructor() { super(); throw new Error("Unsupported"); } });
    await expect(recordWhile(() => true)).rejects.toThrow("Unsupported");
    expect(stop).toHaveBeenCalledOnce();
  });
  it("explains denied microphone access", async () => {
    vi.stubGlobal("MediaRecorder", Recorder);
    vi.stubGlobal("navigator", { mediaDevices: { getUserMedia: vi.fn().mockRejectedValue(Object.assign(new Error("denied"), { name: "NotAllowedError" })) } });
    await expect(recordWhile(() => true)).rejects.toThrow("Microphone access is blocked");
  });
  it("rejects empty recordings before sending to ElevenLabs", async () => {
    const send = vi.fn(); vi.stubGlobal("window", { mascot: { transcribe: send } });
    await expect(transcribe(new Blob([]))).rejects.toThrow("empty");
    expect(send).not.toHaveBeenCalled();
  });
});
