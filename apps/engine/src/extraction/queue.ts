/**
 * Background extraction. Ingest responds as soon as the capture is stored; workers then read the
 * L1 rung plus context, call the model, and write beliefs in their own transaction. Concurrency 2
 * keeps vision calls off the ingest path without hammering the API.
 */
import { Binary } from "mongodb";
import type { MemoryStore } from "../db/memory-store.js";
import { applyExtraction, previousCaptures, type ApplyResult } from "./apply.js";
import type { Extractor } from "./extract.js";

export interface ExtractionQueue {
  enqueue(captureId: string): void;
  /** Resolves when every enqueued capture has been processed (tests, shutdown). */
  drain(): Promise<void>;
  readonly pending: number;
}

export interface QueueOptions {
  store: MemoryStore;
  extractor: Extractor;
  concurrency?: number;
  onDone?: (result: ApplyResult) => void;
  onError?: (captureId: string, error: unknown) => void;
}

function bytesOf(data: unknown): Buffer | null {
  if (data instanceof Binary) return Buffer.from(data.value());
  if (data instanceof Uint8Array) return Buffer.from(data);
  return null;
}

export function createExtractionQueue(opts: QueueOptions): ExtractionQueue {
  const concurrency = opts.concurrency ?? 2;
  const waiting: string[] = [];
  let active = 0;
  let idle: (() => void)[] = [];

  const finish = (): void => {
    active -= 1;
    if (waiting.length === 0 && active === 0) {
      const resolvers = idle;
      idle = [];
      for (const resolve of resolvers) resolve();
    }
    pump();
  };

  const process = async (captureId: string): Promise<void> => {
    try {
      const input = await opts.store.run(false, (data) => {
        const capture = data.captures.find((c) => c._id === captureId);
        if (!capture || capture.extracted) return null;
        const rung = data.levels.find((l) => l.capture_id === captureId && l.level === "L1") ?? data.levels.find((l) => l.capture_id === captureId);
        const image = rung ? bytesOf(rung.data) : null;
        if (!image) return null;
        return {
          image,
          url: capture.url,
          title: capture.title,
          action: `${capture.action.type}${capture.action.text ? ` "${capture.action.text}"` : ""}`,
          ...(capture.page_text ? { pageText: capture.page_text } : {}),
          previous: previousCaptures(data, capture),
        };
      });
      if (!input) return;
      const output = await opts.extractor.extract(input);
      const result = await opts.store.run(true, (data) => applyExtraction(data, captureId, output));
      opts.onDone?.(result);
    } catch (error) {
      opts.onError?.(captureId, error);
    }
  };

  const pump = (): void => {
    while (active < concurrency && waiting.length > 0) {
      const next = waiting.shift()!;
      active += 1;
      void process(next).finally(finish);
    }
  };

  return {
    enqueue(captureId) {
      waiting.push(captureId);
      pump();
    },
    drain() {
      if (waiting.length === 0 && active === 0) return Promise.resolve();
      return new Promise((resolve) => idle.push(resolve));
    },
    get pending() {
      return waiting.length + active;
    },
  };
}
