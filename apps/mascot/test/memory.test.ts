import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MemoryNotebook } from "../src/main/memory";
import { transcribeAudio } from "../src/main/transcribe";

const directories: string[] = [];
afterEach(async () => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); await Promise.all(directories.splice(0).map((path) => rm(path, { recursive: true, force: true }))); });
async function notebook() {
  const directory = await mkdtemp(join(tmpdir(), "cortex-test-"));
  directories.push(directory);
  const path = join(directory, "memories.json");
  return { book: new MemoryNotebook(path, "http://engine.test"), path };
}
const success = () => Response.json({ voice_note_id: "voice-1", beliefs: [], superseded: [], tombstoned: [], cracked_procedures: [] });
describe("durable memory capture", () => {
  it("keeps a note across restarts when the engine is not implemented", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("not implemented", { status: 501 })));
    const { book, path } = await notebook();
    expect(await book.save("  Prefer quiet cafés.  ")).toMatchObject({ text: "Prefer quiet cafés.", status: "pending" });
    expect(await new MemoryNotebook(path, "http://engine.test").list()).toHaveLength(1);
  });
  it("serializes concurrent saves without dropping a memory", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    const { book } = await notebook();
    await Promise.all([book.save("first"), book.save("second")]);
    expect((await book.list()).map((note) => note.text)).toEqual(["second", "first"]);
  });
  it("only marks valid acknowledgments as synced and does not resend synced notes", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(Response.json({ invalid: true })).mockImplementation(success);
    vi.stubGlobal("fetch", fetchMock);
    const { book } = await notebook();
    const note = await book.save("A memory");
    expect(note.status).toBe("pending");
    expect((await book.retry(note.id)).status).toBe("synced");
    await book.retry(note.id);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(JSON.parse(fetchMock.mock.calls[0]![1].body)).toEqual({ transcript: "A memory" });
  });
  it("rejects blank notes without network writes", async () => {
    const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
    const { book } = await notebook();
    await expect(book.save(" ")).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
describe("ElevenLabs transcription", () => {
  it("requires a main-process credential", async () => {
    vi.stubEnv("ELEVENLABS_API_KEY", "");
    await expect(transcribeAudio(new Uint8Array([1]), "audio/webm")).rejects.toThrow("ELEVENLABS_API_KEY");
  });
  it("sends multipart Scribe audio and returns editable text", async () => {
    vi.stubEnv("ELEVENLABS_API_KEY", "test-key");
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ text: "  Hello Cortex  " }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await transcribeAudio(new Uint8Array([1, 2, 3]), "audio/webm")).toBe("Hello Cortex");
    const options = fetchMock.mock.calls[0]![1];
    expect(options.headers).toEqual({ "xi-api-key": "test-key" });
    expect(options.body.get("model_id")).toBe("scribe_v2");
    expect(options.body.get("file").size).toBe(3);
  });
  it("does not treat empty speech or provider errors as usable text", async () => {
    vi.stubEnv("ELEVENLABS_API_KEY", "test-key");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(Response.json({ text: " " })).mockResolvedValueOnce(new Response("error", { status: 401 })));
    await expect(transcribeAudio(new Uint8Array([1]), "audio/webm")).rejects.toThrow("No speech");
    await expect(transcribeAudio(new Uint8Array([1]), "audio/webm")).rejects.toThrow("401");
  });
});
