import { createServer } from "node:http";
import { EventEmitter, once } from "node:events";
import type { AddressInfo } from "node:net";
import type { Db } from "mongodb";
import { WebSocket } from "ws";
import { WsEvent } from "@cortex/schema";
import { afterEach, describe, expect, it, vi } from "vitest";
import { emptyMemory } from "../src/db/memory-data.js";
import { fixtureStore, type MemoryStore } from "../src/db/memory-store.js";
import { createLiveServer } from "../src/live/server.js";
import { snapshot } from "../src/live/snapshot.js";

class FakeWatch extends EventEmitter {
  close = vi.fn(async () => {
    this.emit("close");
  });
  ready() {
    this.emit("resumeTokenChanged", { token: "test" });
  }
  change(coll = "capture_state") {
    this.emit("change", { operationType: "replace", ns: { coll } });
  }
}

function fakeDatabase() {
  const streams: FakeWatch[] = [];
  const watch = vi.fn(() => {
    const stream = new FakeWatch();
    streams.push(stream);
    return stream;
  });
  return { db: { watch } as unknown as Db, watch, streams };
}

const cleanup: Array<() => Promise<void>> = [];
afterEach(async () => {
  for (const stop of cleanup.splice(0).reverse()) await stop();
  vi.restoreAllMocks();
});

async function setup(memory: MemoryStore = fixtureStore(), db?: Db) {
  const server = createServer((_request, response) => {
    response.writeHead(404);
    response.end();
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const live = createLiveServer({ server, memory, ...(db ? { db } : {}) });
  await live.start();
  const base = `ws://127.0.0.1:${(server.address() as AddressInfo).port}`;
  cleanup.push(async () => {
    await live.stop();
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  });
  const connect = async (path = "/ws") => {
    const messages: WsEvent[] = [];
    const socket = new WebSocket(`${base}${path}`);
    socket.on("message", (value) =>
      messages.push(WsEvent.parse(JSON.parse(String(value)))),
    );
    await once(socket, "open");
    return { socket, messages };
  };
  return { live, memory, connect, server };
}

describe("live snapshots", () => {
  it("sends initial snapshots, respects conditions, and refreshes after fixture mutations", async () => {
    const harness = await setup();
    const cortex = await harness.connect();
    const baseline = await harness.connect("/ws?condition=keep_all");
    await vi.waitFor(() => {
      expect(cortex.messages).toHaveLength(1);
      expect(baseline.messages).toHaveLength(1);
    });
    expect(cortex.messages[0]).toMatchObject({
      type: "snapshot",
      condition: "cortex",
      day: 0,
    });
    expect(baseline.messages[0]).toMatchObject({
      type: "snapshot",
      condition: "keep_all",
      day: 0,
    });
    expect(harness.live.clientCount()).toBe(2);
    await harness.memory.run(true, (data) => {
      data.day = 4;
    });
    harness.live.refresh();
    await vi.waitFor(() => expect(cortex.messages.at(-1)?.day).toBe(4));
    expect(baseline.messages.at(-1)?.day).toBe(4);
    expect(cortex.messages.every((event) => event.type === "snapshot")).toBe(
      true,
    );
  });

  it("rejects invalid conditions and paths during the upgrade", async () => {
    const harness = await setup();
    await expect(harness.connect("/ws?condition=unknown")).rejects.toThrow(
      "400",
    );
    await expect(harness.connect("/other")).rejects.toThrow("404");
    expect(harness.live.clientCount()).toBe(0);
  });

  it("does not read with no clients and coalesces relevant database notifications", async () => {
    const database = fakeDatabase();
    const memory = fixtureStore();
    const reads = vi.spyOn(memory, "run");
    const harness = await setup(memory, database.db);
    const stream = database.streams[0]!;
    stream.ready();
    stream.change();
    harness.live.refresh();
    expect(reads).not.toHaveBeenCalled();
    const client = await harness.connect();
    await vi.waitFor(() => expect(client.messages).toHaveLength(1));
    reads.mockClear();
    for (let i = 0; i < 20; i++) stream.change();
    await vi.waitFor(() => expect(client.messages).toHaveLength(2));
    expect(reads).toHaveBeenCalledTimes(1);
    reads.mockClear();
    stream.change("listings");
    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(reads).not.toHaveBeenCalled();
    expect(database.watch.mock.calls[0]).toBeDefined();
  });

  it("serializes overlapping reads and gives connections during a read a fresh snapshot", async () => {
    const store = fixtureStore();
    let held = false;
    let release: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let active = 0;
    let maximumActive = 0;
    const memory: MemoryStore = {
      async run(write, action) {
        active++;
        maximumActive = Math.max(maximumActive, active);
        try {
          const result = await store.run(write, action);
          if (held) {
            held = false;
            await gate;
          }
          return result;
        } finally {
          active--;
        }
      },
    };
    const harness = await setup(memory);
    const first = await harness.connect();
    await vi.waitFor(() => expect(first.messages).toHaveLength(1));
    held = true;
    harness.live.refresh();
    await vi.waitFor(() => expect(active).toBe(1));
    await store.run(true, (data) => {
      data.day = 5;
    });
    harness.live.refresh();
    const second = await harness.connect();
    release!();
    await vi.waitFor(() => {
      expect(first.messages.at(-1)?.day).toBe(5);
      expect(second.messages.at(-1)?.day).toBe(5);
    });
    expect(second.messages).toHaveLength(1);
    expect(maximumActive).toBe(1);
    expect(first.messages.map((event) => event.day)).toEqual([0, 0, 5]);
  });

  it("publishes explicitly supplied events only to the matching condition", async () => {
    const harness = await setup();
    const client = await harness.connect();
    await vi.waitFor(() => expect(client.messages).toHaveLength(1));
    const other = snapshot(emptyMemory(), "keep_all");
    const own = snapshot(emptyMemory(), "cortex");
    harness.live.publish(other);
    harness.live.publish(own);
    await vi.waitFor(() => expect(client.messages).toHaveLength(2));
    expect(client.messages[1]?.id).toBe(own.id);
  });

  it("closes clients on watch errors, retries, and serves a fresh snapshot after reconnect", async () => {
    const logs = vi.spyOn(console, "error").mockImplementation(() => {});
    const database = fakeDatabase();
    const harness = await setup(fixtureStore(), database.db);
    database.streams[0]!.ready();
    const client = await harness.connect();
    await vi.waitFor(() => expect(client.messages).toHaveLength(1));
    const closed = once(client.socket, "close");
    database.streams[0]!.emit("error", new Error("sensitive-driver-details"));
    expect((await closed)[0]).toBe(1011);
    await expect(harness.connect()).rejects.toThrow("503");
    await vi.waitFor(() => expect(database.streams).toHaveLength(2), {
      timeout: 2000,
    });
    await harness.memory.run(true, (data) => {
      data.day = 9;
    });
    database.streams[1]!.ready();
    const reconnected = await harness.connect();
    await vi.waitFor(() => expect(reconnected.messages[0]?.day).toBe(9));
    expect(database.streams[0]!.close).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(logs.mock.calls)).not.toContain(
      "sensitive-driver-details",
    );
  });

  it("closes clients and the watcher and cancels pending refreshes on stop", async () => {
    const database = fakeDatabase();
    const store = fixtureStore();
    const reads = vi.spyOn(store, "run");
    const harness = await setup(store, database.db);
    database.streams[0]!.ready();
    const client = await harness.connect();
    await vi.waitFor(() => expect(client.messages).toHaveLength(1));
    reads.mockClear();
    harness.live.refresh();
    const closed = once(client.socket, "close");
    await harness.live.stop();
    expect((await closed)[0]).toBe(1001);
    expect(database.streams[0]!.close).toHaveBeenCalledTimes(1);
    expect(harness.live.clientCount()).toBe(0);
    expect(harness.server.listenerCount("upgrade")).toBe(0);
    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(reads).not.toHaveBeenCalled();
  });

  it("closes clients with a safe error when snapshot reads fail", async () => {
    const logs = vi.spyOn(console, "error").mockImplementation(() => {});
    const memory = fixtureStore();
    vi.spyOn(memory, "run").mockRejectedValue(
      new Error("sensitive-store-details"),
    );
    const harness = await setup(memory);
    const client = await harness.connect();
    expect((await once(client.socket, "close"))[0]).toBe(1011);
    expect(client.messages).toHaveLength(0);
    expect(JSON.stringify(logs.mock.calls)).not.toContain(
      "sensitive-store-details",
    );
  });

  it("cancels watcher recovery when stopped during the retry delay", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const database = fakeDatabase();
    const harness = await setup(fixtureStore(), database.db);
    database.streams[0]!.ready();
    database.streams[0]!.emit("error", new Error("test failure"));
    await harness.live.stop();
    await new Promise((resolve) => setTimeout(resolve, 1050));
    expect(database.streams).toHaveLength(1);
    expect(harness.server.listenerCount("upgrade")).toBe(0);
  });
});
