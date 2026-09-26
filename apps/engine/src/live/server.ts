/**
 * Holds one cluster-wide change stream and fans WsEvents out to palace/mascot clients over ws.
 * Sweeps are coalesced per capture. Clients call GET /snapshot on connect. docs/contracts.md > WebSocket.
 */
import type { WsEvent } from "@cortex/schema";
import { NotImplemented } from "../lib/errors.js";

export interface LiveServer {
  start(): Promise<void>;
  stop(): Promise<void>;
  /** Broadcast an event produced by the engine itself (clock.advanced, snapshot, procedure.step). */
  publish(event: WsEvent): void;
  clientCount(): number;
}

export function createLiveServer(): LiveServer {
  return {
    async start() {
      // db.watch([], {fullDocument: "updateLookup"}) → translate() → publish(); WebSocketServer on /ws
      throw new NotImplemented("live/server.start");
    },
    async stop() {
      throw new NotImplemented("live/server.stop");
    },
    publish() {
      throw new NotImplemented("live/server.publish");
    },
    clientCount() {
      return 0;
    },
  };
}
