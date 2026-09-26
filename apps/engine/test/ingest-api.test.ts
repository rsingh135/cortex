import { describe, expect, it } from "vitest";
import {
  EndEpisodeResponse,
  IngestCaptureResponse,
  Snapshot,
  RecallResponse,
} from "@cortex/schema";
import { createApp } from "../src/api/app.js";
import { fixtureStore } from "../src/db/memory-store.js";
import { testImage } from "./helpers.js";

const post = (app: ReturnType<typeof createApp>, path: string, body: unknown) =>
  app.request(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
function form(image: Uint8Array, episode: string) {
  const body = new FormData();
  body.set(
    "meta",
    JSON.stringify({
      episode_id: episode,
      day: 2,
      actor: "maya",
      app: "mockloft",
      url: "http://mock/listings/1",
      title: "Sunny apartment",
      action: { type: "load" },
      page_text: "unextracted raw page",
      listing: { listing_id: "listing:1", attrs: { price: 2800 } },
    }),
  );
  body.set(
    "image",
    new Blob([new Uint8Array(image)], { type: "image/png" }),
    "capture.png",
  );
  return body;
}

describe("capture HTTP pipeline", () => {
  it("stores a capture, skips a duplicate, ends the episode and recalls its evidence", async () => {
    const memory = fixtureStore();
    const app = createApp({ fixtureMode: true, memory });
    const episode = (await (
      await post(app, "/episodes", { day: 2, actor: "maya", app: "mockloft" })
    ).json()) as { episode_id: string };
    const image = await testImage(400, 300);
    const response = await app.request("/ingest/capture", {
      method: "POST",
      body: form(image, episode.episode_id),
    });
    expect(response.status).toBe(200);
    const capture = IngestCaptureResponse.parse(await response.json());
    expect(capture.stored).toBe(true);
    const duplicate = IngestCaptureResponse.parse(
      await (
        await app.request("/ingest/capture", {
          method: "POST",
          body: form(image, episode.episode_id),
        })
      ).json(),
    );
    expect(duplicate).toMatchObject({
      capture_id: capture.capture_id,
      stored: false,
    });
    expect(
      await memory.run(false, (d) => [
        d.levels.length,
        d.captureStates.length,
        d.episodes[0]?.capture_count,
      ]),
    ).toEqual([4, 3, 1]);
    const end = EndEpisodeResponse.parse(
      await (
        await app.request(`/episodes/${episode.episode_id}/end`, {
          method: "POST",
        })
      ).json(),
    );
    expect(end.summary_belief_id).toBeTruthy();
    expect(end.summary).toContain("Sunny apartment");
    expect(
      await (
        await app.request(`/episodes/${episode.episode_id}/end`, {
          method: "POST",
        })
      ).json(),
    ).toEqual(end);
    const recalled = RecallResponse.parse(
      await (
        await post(app, "/recall", {
          query: "Sunny apartment",
          by: "agent",
          reason: "Find previous activity",
          with_images: true,
        })
      ).json(),
    );
    expect(recalled.beliefs[0]?.evidence_images?.[0]?.capture_id).toBe(
      capture.capture_id,
    );
    expect(
      (await app.request(`/image/${capture.capture_id}`)).headers.get(
        "Content-Type",
      ),
    ).toBe("image/webp");
    const snapshot = Snapshot.parse(
      await (await app.request("/snapshot")).json(),
    );
    expect(snapshot.payload.captures[0]?.listing?.attrs.price).toBe(2800);
    expect(JSON.stringify(snapshot)).not.toContain("unextracted raw page");
    expect(snapshot.payload.beliefs).toHaveLength(1);
    expect(
      (
        await app.request("/ingest/capture", {
          method: "POST",
          body: form(image, episode.episode_id),
        })
      ).status,
    ).toBe(400);
  });

  it("handles unknown/empty episodes and rejects malformed uploads", async () => {
    const memory = fixtureStore();
    const app = createApp({ fixtureMode: true, memory });
    expect(
      (await app.request("/episodes/missing/end", { method: "POST" })).status,
    ).toBe(404);
    const episode = (await (
      await post(app, "/episodes", { day: 0, actor: "maya", app: "inbox" })
    ).json()) as { episode_id: string };
    const end = EndEpisodeResponse.parse(
      await (
        await app.request(`/episodes/${episode.episode_id}/end`, {
          method: "POST",
        })
      ).json(),
    );
    expect(end.summary_belief_id).toBeUndefined();
    const malformed = new FormData();
    malformed.set("meta", "{");
    expect(
      (
        await app.request("/ingest/capture", {
          method: "POST",
          body: malformed,
        })
      ).status,
    ).toBe(400);
    const missingImage = form(new Uint8Array([0]), "autocreated");
    missingImage.delete("image");
    expect(
      (
        await app.request("/ingest/capture", {
          method: "POST",
          body: missingImage,
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await app.request("/ingest/capture", {
          method: "POST",
          body: form(new Uint8Array([0]), "autocreated"),
        })
      ).status,
    ).toBe(400);
    expect(await memory.run(false, (d) => d.captures.length)).toBe(0);
  });
});
