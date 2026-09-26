/**
 * Builds the bundled beat-1 event log the palace replays when no engine is streaming:
 * one `capture.created` per recorded capture (pointing at the bundled WebP) and one
 * `belief.created` per decision Maya made, timed like the real run. Output validates against
 * WsEvent so replay mode and live mode share one path.
 *
 *   pnpm build-event-log [--captures <dir with captures.jsonl>] [--out apps/palace/public/demo/day2-events.jsonl]
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { ulid } from "ulid";
import { WsEvent, type Belief, type Capture, type IngestCaptureMeta } from "@cortex/schema";
import { listings as loadListings } from "@cortex/persona";

interface Record {
  n: number;
  file: string;
  meta: Omit<IngestCaptureMeta, "page_text">;
}

const CAPTURE_BYTES = 150_000;

function captureDoc(rec: Record, id: string, ts: string): Omit<Capture, "page_text"> {
  return {
    _id: id,
    episode_id: rec.meta.episode_id,
    day: rec.meta.day,
    ts,
    actor: rec.meta.actor,
    app: rec.meta.app,
    url: rec.meta.url.replace(/^https?:\/\/[^/]+/, ""),
    title: rec.meta.title,
    action: rec.meta.action,
    phash: "0".repeat(16),
    extracted: true,
    belief_ids: [],
    l0_bytes: CAPTURE_BYTES,
  };
}

function beliefFor(rec: Record, captureId: string, listingTitle: string, ts: string, day: number): (Belief & { confidence: number }) | null {
  const listing = rec.meta.listing?.listing_id;
  if (!listing) return null;
  const t = rec.meta.action.type;
  let predicate: Belief["triple"]["p"];
  let text: string;
  if (t === "submit") {
    predicate = "messaged";
    text = `Maya messaged the landlord of ${listingTitle} (${listing})`;
  } else if (t === "click" && rec.meta.action.text === "Reject") {
    predicate = "rejected";
    text = `Maya rejected ${listingTitle} (${listing})`;
  } else if (t === "dwell") {
    predicate = "viewed";
    text = `Maya spent time reading ${listingTitle} (${listing})`;
  } else return null;
  return {
    _id: ulid(),
    triple: { s: "maya", p: predicate, o: listing },
    text,
    kind: "event",
    room: "Housing",
    source: "screen",
    inferred: false,
    pinned: false,
    c0: 0.3,
    confidence: 0.3,
    evidence: [captureId],
    created_day: day,
    history: [{ day, event: "created", note: "extracted from screenshot" }],
  };
}

export function buildEventLog(records: Record[], webpBase: string, titles: Map<string, string>): string[] {
  const lines: string[] = [];
  const t0 = Date.now();
  let offset = 0;
  for (const rec of records) {
    offset += 2500;
    const ts = new Date(t0 + offset).toISOString();
    const captureId = ulid();
    const name = `${String(rec.n).padStart(3, "0")}-${rec.meta.app}-${rec.meta.action.type}.webp`;
    const capture = { ...captureDoc(rec, captureId, ts), image_url: `${webpBase}/${name}` };
    const created = WsEvent.parse({ id: ulid(), type: "capture.created", day: rec.meta.day, ts, condition: "cortex", payload: capture });
    lines.push(JSON.stringify({ ...created, payload: capture }));
    const belief = beliefFor(rec, captureId, titles.get(rec.meta.listing?.listing_id ?? "") ?? "a listing", ts, rec.meta.day);
    if (belief) {
      const bts = new Date(t0 + offset + 1200).toISOString();
      lines.push(JSON.stringify(WsEvent.parse({ id: ulid(), type: "belief.created", day: rec.meta.day, ts: bts, condition: "cortex", payload: belief })));
      lines.push(
        JSON.stringify(
          WsEvent.parse({ id: ulid(), type: "edge.created", day: rec.meta.day, ts: bts, condition: "cortex", payload: { _id: ulid(), from: belief._id, to: captureId, type: "evidence", weight: 1 } }),
        ),
      );
    }
  }
  return lines;
}

function main(): void {
  const argv = process.argv.slice(2);
  const arg = (flag: string): string | undefined => {
    const i = argv.indexOf(flag);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const capturesDir = arg("--captures") ?? "captures";
  const out = arg("--out") ?? "apps/palace/public/demo/day2-events.jsonl";
  const logPath = join(capturesDir, "captures.jsonl");
  if (!existsSync(logPath)) throw new Error(`no captures.jsonl in ${capturesDir}; run pnpm play-maya first`);
  const records = readFileSync(logPath, "utf8").trim().split("\n").map((l) => JSON.parse(l) as Record);
  const titles = new Map(loadListings().map((l) => [l._id, l.title]));
  const lines = buildEventLog(records, "/captures", titles);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, `${lines.join("\n")}\n`);
  console.log(`wrote ${lines.length} events from ${records.length} captures -> ${out}`);
}

if (process.argv[1] && /build-event-log\.ts$/.test(process.argv[1])) {
  try {
    main();
  } catch (err) {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  }
}
