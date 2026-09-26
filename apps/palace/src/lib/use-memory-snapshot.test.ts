// @vitest-environment happy-dom
import { act, createElement, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Condition } from "@cortex/schema";
import { graphDemo } from "./graph-demo";
import { engineAddress, useMemorySnapshot } from "./use-memory-snapshot";

class FakeSocket {
  static sockets: FakeSocket[] = [];
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  closed = false;
  constructor(readonly url: URL) {
    FakeSocket.sockets.push(this);
  }
  close() {
    this.closed = true;
    this.onclose?.();
  }
  receive(day: number, condition: Condition = "cortex") {
    this.onmessage?.({
      data: JSON.stringify({ ...graphDemo(), day, condition }),
    });
  }
}

let root: Root;
let element: HTMLDivElement;
let result: ReturnType<typeof useMemorySnapshot>;
let requests: Array<{
  signal: AbortSignal;
  resolve: (response: Response) => void;
}>;
function Probe({
  enabled,
  condition,
}: {
  enabled: boolean;
  condition: Condition;
}) {
  const value = useMemorySnapshot(enabled, condition);
  useEffect(() => {
    result = value;
  }, [value]);
  return null;
}
async function render(enabled = true, condition: Condition = "cortex") {
  await act(async () => {
    root.render(createElement(Probe, { enabled, condition }));
  });
}
async function reply(
  index: number,
  day: number,
  condition: Condition = "cortex",
) {
  await act(async () => {
    requests[index].resolve(
      new Response(JSON.stringify({ ...graphDemo(), day, condition }), {
        status: 200,
      }),
    );
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("WebSocket", FakeSocket);
  vi.stubEnv("NEXT_PUBLIC_ENGINE_HTTP_URL", "");
  vi.stubEnv("NEXT_PUBLIC_ENGINE_URL", "");
  vi.stubEnv("NEXT_PUBLIC_LIVE_SERVER_WS_URL", "");
  FakeSocket.sockets = [];
  requests = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(
      (_url: string, options: { signal: AbortSignal }) =>
        new Promise<Response>((resolve) => {
          // Deliberately ignore cancellation so the identity guard is exercised, too.
          requests.push({ signal: options.signal, resolve });
        }),
    ),
  );
  element = document.createElement("div");
  document.body.append(element);
  root = createRoot(element);
});
afterEach(async () => {
  await act(async () => {
    root.unmount();
  });
  element.remove();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("memory snapshot synchronization", () => {
  it("ignores HTTP results and late socket events from retired connection attempts", async () => {
    await render();
    const oldMessage = FakeSocket.sockets[0].onmessage;
    await act(async () => {
      FakeSocket.sockets[0].close();
    });
    expect(requests[0].signal.aborted).toBe(true);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    await act(async () => {
      FakeSocket.sockets[1].receive(10);
    });
    await reply(0, 2);
    await act(async () => {
      oldMessage?.({ data: JSON.stringify({ ...graphDemo(), day: 3 }) });
    });
    await reply(1, 5);
    expect(result.snapshot?.day).toBe(10);
    expect(result.status).toBe("live");
  });

  it("retires the old condition and ignores its delayed HTTP response", async () => {
    await render();
    await act(async () => {
      FakeSocket.sockets[0].receive(4);
    });
    await render(true, "keep_all");
    expect(result.snapshot).toBeNull();
    expect(result.status).toBe("connecting");
    expect(FakeSocket.sockets[0].closed).toBe(true);
    await reply(0, 9);
    expect(result.snapshot).toBeNull();
    await reply(1, 6, "keep_all");
    expect(result.snapshot?.condition).toBe("keep_all");
    await act(async () => {
      FakeSocket.sockets[1].receive(7, "keep_all");
    });
    expect(result.snapshot?.day).toBe(7);
    expect(result.status).toBe("live");
  });

  it("pauses retries in demo mode and establishes a fresh live connection when re-enabled", async () => {
    await render();
    await act(async () => {
      FakeSocket.sockets[0].receive(4);
      FakeSocket.sockets[0].close();
    });
    await render(false);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(20_000);
    });
    expect(FakeSocket.sockets).toHaveLength(1);
    await render();
    expect(FakeSocket.sockets).toHaveLength(2);
    expect(result.status).toBe("connecting");
    await reply(0, 99);
    await act(async () => {
      FakeSocket.sockets[1].receive(8);
    });
    expect(result.snapshot?.day).toBe(8);
    expect(result.status).toBe("live");
  });

  it("retries socket errors even without a close event and ignores unrelated messages", async () => {
    await render();
    await act(async () => {
      FakeSocket.sockets[0].onerror?.();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(FakeSocket.sockets).toHaveLength(2);
    await act(async () => {
      FakeSocket.sockets[1].receive(8);
      FakeSocket.sockets[1].onmessage?.({ data: "not JSON" });
      FakeSocket.sockets[1].receive(2, "blur_by_age");
    });
    expect(result.snapshot?.day).toBe(8);
    expect(result.status).toBe("live");
  });

  it("supports the teammate engine URL while giving the explicit HTTP URL precedence", () => {
    vi.stubEnv("NEXT_PUBLIC_ENGINE_HTTP_URL", "");
    vi.stubEnv("NEXT_PUBLIC_ENGINE_URL", "https://engine.example/");
    expect(engineAddress()).toBe("https://engine.example");
    vi.stubEnv("NEXT_PUBLIC_ENGINE_HTTP_URL", "https://override.example/");
    expect(engineAddress()).toBe("https://override.example");
  });
});
