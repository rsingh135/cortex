/**
 * Snapshot synchronization for /ws. Database changes trigger a fresh joined snapshot;
 * this deliberately does not infer recall/forgetting events from document replacements.
 */
import type { IncomingMessage, Server } from "node:http";
import type { Duplex } from "node:stream";
import type { ChangeStream, Db } from "mongodb";
import { WebSocket, WebSocketServer } from "ws";
import { Condition, WsEvent } from "@cortex/schema";
import type { MemoryStore } from "../db/memory-store.js";
import { snapshot } from "./snapshot.js";

export interface LiveServer {
  start(): Promise<void>;
  stop(): Promise<void>;
  /** Broadcast an explicitly produced event; snapshot synchronization does not fabricate these. */
  publish(event: WsEvent): void;
  /** Notify fixture clients after a successful in-memory mutation. */
  refresh(): void;
  clientCount(): number;
}

export interface LiveServerOptions {
  server: Server;
  memory: MemoryStore;
  db?: Db;
}

const COLLECTIONS = [
  "clock",
  "captures",
  "capture_state",
  "image_levels",
  "beliefs",
  "belief_state",
  "procedures",
  "edges",
];
const DEBOUNCE_MS = 40;

export function createLiveServer({
  server,
  memory,
  db,
}: LiveServerOptions): LiveServer {
  const clients = new Map<WebSocket, Condition>();
  let sockets: WebSocketServer | undefined;
  let watch: ChangeStream | undefined;
  let watchClosing = Promise.resolve();
  let running = false;
  let healthy = !db;
  let dirty = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  let retries = 0;
  let refreshing: Promise<void> | undefined;

  const clientCount = () =>
    [...clients.keys()].filter((client) => client.readyState === WebSocket.OPEN)
      .length;
  const send = (client: WebSocket, event: WsEvent) => {
    if (client.readyState !== WebSocket.OPEN) return;
    if (client.bufferedAmount > 4 * 1024 * 1024) {
      client.close(1013, "Client is too slow");
      return;
    }
    client.send(JSON.stringify(event), (error) => {
      if (error) client.terminate();
    });
  };
  const publish = (event: WsEvent) => {
    if (!running) return;
    const validated = WsEvent.parse(event);
    for (const [client, condition] of clients)
      if (condition === validated.condition) send(client, validated);
  };

  const flush = async () => {
    while (running && healthy && dirty && clientCount()) {
      dirty = false;
      // New connections arriving during this read wait for the next read, avoiding stale initial snapshots.
      const audience = [...clients].filter(
        ([client]) => client.readyState === WebSocket.OPEN,
      );
      const conditions = [
        ...new Set(audience.map(([, condition]) => condition)),
      ];
      const events = await memory.run(
        false,
        (data) =>
          new Map(
            conditions.map((condition) => [
              condition,
              snapshot(data, condition),
            ]),
          ),
      );
      if (!running || !healthy) return;
      for (const [client, condition] of audience)
        send(client, events.get(condition)!);
    }
  };
  const refresh = () => {
    if (!running || !healthy || !clientCount()) return;
    dirty = true;
    if (timer || refreshing) return;
    timer = setTimeout(() => {
      timer = undefined;
      refreshing = flush()
        .catch(() => {
          console.error("engine: live snapshot refresh failed");
          for (const client of clients.keys())
            client.close(1011, "Memory snapshot unavailable");
        })
        .finally(() => {
          refreshing = undefined;
          if (dirty) refresh();
        });
    }, DEBOUNCE_MS);
  };

  const retryWatch = () => {
    if (!running || retryTimer) return;
    const delay = Math.min(1000 * 2 ** Math.min(retries++, 4), 10_000);
    retryTimer = setTimeout(() => {
      retryTimer = undefined;
      openWatch();
    }, delay);
  };
  const failedWatch = (failed: ChangeStream | undefined) => {
    if (!running || failed !== watch) return;
    watch = undefined;
    healthy = false;
    dirty = false;
    clearTimeout(timer);
    timer = undefined;
    console.error("engine: live change stream unavailable; retrying");
    for (const client of clients.keys())
      client.close(1011, "Memory updates unavailable");
    watchClosing = (failed?.close() ?? Promise.resolve()).catch(() => {
      console.error("engine: live change stream close failed");
    });
    void watchClosing.then(retryWatch);
  };
  const openWatch = () => {
    if (!running || !db) return;
    try {
      const stream = db.watch(
        [
          {
            $match: {
              "ns.coll": { $in: COLLECTIONS },
              operationType: { $in: ["insert", "update", "replace", "delete"] },
            },
          },
          // Only the notification is needed; never transfer screenshot blobs through the watcher.
          { $project: { _id: 1, operationType: 1, ns: 1, clusterTime: 1 } },
        ],
        { maxAwaitTimeMS: 1000 },
      );
      watch = stream;
      const ready = () => {
        if (watch !== stream || !running) return;
        healthy = true;
        retries = 0;
        refresh();
      };
      // Initial empty batches also carry a resume token. Refresh on readiness to close the startup read gap.
      stream.once("resumeTokenChanged", ready);
      stream.on("error", () => failedWatch(stream));
      stream.on("close", () => failedWatch(stream));
      stream.on("change", (change) => {
        if (watch !== stream) return;
        if (
          "ns" in change &&
          "coll" in change.ns &&
          COLLECTIONS.includes(change.ns.coll)
        ) {
          if (!healthy) ready();
          else refresh();
        }
      });
    } catch {
      failedWatch(watch);
    }
  };

  const upgrade = (request: IncomingMessage, socket: Duplex, head: Buffer) => {
    let url: URL;
    try {
      url = new URL(request.url ?? "", "http://localhost");
    } catch {
      socket.end("HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n");
      return;
    }
    if (url.pathname !== "/ws") {
      socket.end("HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n");
      return;
    }
    const condition = Condition.safeParse(
      url.searchParams.get("condition") ?? "cortex",
    );
    if (!condition.success) {
      socket.end("HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n");
      return;
    }
    if (!running || !healthy || !sockets) {
      socket.end(
        "HTTP/1.1 503 Service Unavailable\r\nConnection: close\r\n\r\n",
      );
      return;
    }
    sockets.handleUpgrade(request, socket, head, (client) => {
      clients.set(client, condition.data);
      client.on("close", () => clients.delete(client));
      client.on("error", () => client.terminate());
      refresh();
    });
  };

  return {
    async start() {
      if (running) return;
      running = true;
      healthy = !db;
      retries = 0;
      sockets = new WebSocketServer({ noServer: true, maxPayload: 64 * 1024 });
      sockets.on("error", () =>
        console.error("engine: WebSocket server error"),
      );
      server.on("upgrade", upgrade);
      openWatch();
    },
    async stop() {
      if (!running) return;
      running = false;
      healthy = false;
      dirty = false;
      server.off("upgrade", upgrade);
      clearTimeout(timer);
      clearTimeout(retryTimer);
      timer = retryTimer = undefined;
      const stream = watch;
      watch = undefined;
      const socketServer = sockets;
      sockets = undefined;
      const closedSockets = new Promise<void>((resolve) => {
        if (!socketServer) {
          resolve();
          return;
        }
        for (const client of clients.keys())
          client.close(1001, "Engine stopping");
        const terminate = setTimeout(() => {
          for (const client of clients.keys()) client.terminate();
        }, 250);
        socketServer.close(() => {
          clearTimeout(terminate);
          clients.clear();
          resolve();
        });
      });
      const cleanup = await Promise.allSettled([
        stream?.close(),
        watchClosing,
        refreshing,
        closedSockets,
      ]);
      if (cleanup.some((result) => result.status === "rejected"))
        throw new Error("Live server shutdown failed");
    },
    publish,
    refresh,
    clientCount,
  };
}
