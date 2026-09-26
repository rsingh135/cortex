import { afterEach, describe, expect, it, vi } from "vitest";
import { EMMA_VOICE_ID, synthesizeSpeech } from "../src/main/speech";

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
describe("Emma speech", () => {
  it("uses exactly the selected voice and returns MP3 bytes", async () => {
    vi.stubEnv("ELEVENLABS_API_KEY", "test-key");
    const fetch = vi.fn().mockResolvedValue(new Response(new Uint8Array([73, 68, 51])));
    vi.stubGlobal("fetch", fetch);
    expect(await synthesizeSpeech("Hello Cortex")).toEqual(new Uint8Array([73, 68, 51]));
    expect(EMMA_VOICE_ID).toBe("56bWURjYFHyYyVf490Dp");
    expect(fetch.mock.calls[0]![0]).toContain(`/text-to-speech/${EMMA_VOICE_ID}`);
    expect(JSON.parse(fetch.mock.calls[0]![1].body).text).toBe("Hello Cortex");
  });
  it("rejects blank and oversized requests without billing", async () => {
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    await expect(synthesizeSpeech(" ")).rejects.toThrow("5,000");
    await expect(synthesizeSpeech("x".repeat(5001))).rejects.toThrow("5,000");
    expect(fetch).not.toHaveBeenCalled();
  });
  it("reports account billing restrictions without changing voices", async () => {
    vi.stubEnv("ELEVENLABS_API_KEY", "test-key");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 402 })));
    await expect(synthesizeSpeech("Hello")).rejects.toThrow("402");
  });
});
