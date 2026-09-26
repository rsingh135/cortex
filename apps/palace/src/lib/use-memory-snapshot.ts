"use client";
import { useEffect, useState } from "react";
import { Snapshot, type Condition } from "@cortex/schema";
import type { MemorySnapshot } from "./memory-graph";

export function engineAddress() {
  const explicit =
    process.env.NEXT_PUBLIC_ENGINE_HTTP_URL ||
    process.env.NEXT_PUBLIC_ENGINE_URL;
  if (explicit) return explicit.replace(/\/$/, "");
  const configured = process.env.NEXT_PUBLIC_LIVE_SERVER_WS_URL;
  if (configured) {
    const url = new URL(configured);
    url.protocol = url.protocol === "wss:" ? "https:" : "http:";
    url.pathname = url.pathname.replace(/\/ws\/?$/, "");
    url.search = "";
    return url.toString().replace(/\/$/, "");
  }
  return "http://localhost:4000";
}

type Connection = "connecting" | "live" | "reconnecting" | "offline";
export function useMemorySnapshot(enabled: boolean, condition: Condition) {
  const [state, setState] = useState<{
    snapshot: MemorySnapshot | null;
    condition: Condition;
    status: Connection;
  }>({ snapshot: null, condition, status: "connecting" });
  useEffect(() => {
    if (!enabled) return;
    let disposed = false;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let attempts = 0;
    let activeAttempt = 0;
    let cancelAttempt = () => {};
    const mark = (status: Connection) => {
      if (!disposed)
        setState((previous) => ({
          snapshot: previous.condition === condition ? previous.snapshot : null,
          condition,
          status,
        }));
    };
    const connect = () => {
      const attempt = ++activeAttempt;
      const abort = new AbortController();
      const current = () => !disposed && activeAttempt === attempt;
      let socket: WebSocket | undefined;
      let receivedSocketSnapshot = false;
      const retire = () => {
        abort.abort();
        if (socket) {
          socket.onmessage = socket.onclose = socket.onerror = null;
          try {
            socket.close();
          } catch {
            /* Already closed or never connected. */
          }
        }
      };
      cancelAttempt = retire;
      const reconnect = () => {
        if (!current()) return;
        ++activeAttempt;
        retire();
        mark("reconnecting");
        retry = setTimeout(
          connect,
          Math.min(1000 * 2 ** Math.min(attempts++, 4), 10000),
        );
      };
      const accept = (value: unknown, status: Connection) => {
        const parsed = Snapshot.safeParse(value);
        if (
          current() &&
          parsed.success &&
          parsed.data.condition === condition
        ) {
          setState({ snapshot: parsed.data, condition, status });
          return true;
        }
        return false;
      };
      mark(attempts ? "reconnecting" : "connecting");
      try {
        const base = engineAddress();
        const url = new URL(`${base}/ws`);
        url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
        url.searchParams.set("condition", condition);
        socket = new WebSocket(url);
        // Cancel and identify every attempt separately: a retired HTTP response must never win.
        void fetch(`${base}/snapshot?condition=${condition}`, {
          signal: abort.signal,
        })
          .then(async (response) => {
            if (!response.ok) throw new Error();
            return response.json();
          })
          .then((value) => {
            if (!receivedSocketSnapshot) accept(value, "connecting");
          })
          .catch(() => {
            if (current() && !receivedSocketSnapshot) mark("offline");
          });
        socket.onmessage = (event) => {
          try {
            if (accept(JSON.parse(String(event.data)), "live")) {
              receivedSocketSnapshot = true;
              attempts = 0;
            }
          } catch {
            // Ignore malformed or unrelated messages; preserve the last validated snapshot.
          }
        };
        socket.onclose = reconnect;
        socket.onerror = reconnect;
      } catch {
        reconnect();
      }
    };
    connect();
    return () => {
      disposed = true;
      ++activeAttempt;
      cancelAttempt();
      clearTimeout(retry);
    };
  }, [enabled, condition]);
  return state.condition === condition
    ? state
    : { snapshot: null, condition, status: "connecting" as const };
}
