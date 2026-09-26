import { readFile, mkdir, writeFile, rename } from "node:fs/promises";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";
import { VoiceRequest, VoiceResponse } from "@cortex/schema";
import type { MemoryNote } from "../shared/types";

/** Serialize disk mutations so two captures can never overwrite each other. */
export class MemoryNotebook {
  private chain: Promise<unknown> = Promise.resolve();
  constructor(private path: string, private engine: string) {}
  async list(): Promise<MemoryNote[]> {
    await this.chain;
    return this.read();
  }
  private async read(): Promise<MemoryNote[]> {
    try { return JSON.parse(await readFile(this.path, "utf8")) as MemoryNote[]; }
    catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return []; throw error; }
  }
  private async write(notes: MemoryNote[]): Promise<void> {
    await mkdir(dirname(this.path), { recursive: true });
    await writeFile(`${this.path}.tmp`, JSON.stringify(notes, null, 2), { mode: 0o600 });
    await rename(`${this.path}.tmp`, this.path);
  }
  save(text: string): Promise<MemoryNote> {
    return this.mutate(async () => {
      const transcript = VoiceRequest.parse({ transcript: text.trim() }).transcript;
      if (transcript.length > 10000) throw new Error("Please keep memories under 10,000 characters.");
      const note: MemoryNote = { id: randomUUID(), text: transcript, createdAt: new Date().toISOString(), status: "pending" };
      const notes = await this.read();
      notes.unshift(note);
      await this.write(notes); // Durable before attempting the network.
      return this.deliver(note, notes);
    });
  }
  retry(id: string): Promise<MemoryNote> {
    return this.mutate(async () => {
      const notes = await this.read();
      const note = notes.find((item) => item.id === id);
      if (!note) throw new Error("Memory not found.");
      return note.status === "synced" ? note : this.deliver(note, notes);
    });
  }
  private mutate<T>(fn: () => Promise<T>): Promise<T> {
    const result = this.chain.then(fn);
    this.chain = result.catch(() => {});
    return result;
  }
  private async deliver(note: MemoryNote, notes: MemoryNote[]): Promise<MemoryNote> {
    try {
      const response = await fetch(`${this.engine}/voice`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ transcript: note.text }), signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) throw new Error(response.status === 501 ? "Memory engine is not ready yet." : `Memory engine returned ${response.status}.`);
      VoiceResponse.parse(await response.json());
      note.status = "synced";
      delete note.error;
    } catch (error) {
      note.error = error instanceof Error ? error.message : "Could not confirm delivery.";
    }
    await this.write(notes);
    return note;
  }
}
