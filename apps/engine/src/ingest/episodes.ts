import { ulid } from "ulid";
import {
  CONDITIONS,
  DEFAULT_PARAMS,
  StartEpisodeRequest,
  EndEpisodeResponse,
  type Room,
} from "@cortex/schema";
import type { MemoryData } from "../db/memory-data.js";
import { advanceMemory } from "../forgetting/sweep.js";

export function startEpisode(data: MemoryData, input: unknown, now: string) {
  const request = StartEpisodeRequest.parse(input);
  if (request.day < data.day)
    throw new RangeError("Episode day cannot precede the memory clock");
  if (request.day > data.day) advanceMemory(data, request.day);
  const id = ulid();
  data.episodes.push({
    _id: id,
    ...request,
    started_at: now,
    capture_count: 0,
  });
  return { episode_id: id };
}

/** A factual activity summary from metadata, without inventing extracted preferences. */
export function endEpisode(data: MemoryData, id: string, now: string) {
  const episode = data.episodes.find((e) => e._id === id);
  if (!episode) return null;
  if (episode.ended_at)
    return EndEpisodeResponse.parse({
      episode_id: id,
      summary: episode.summary ?? "",
      summary_belief_id: episode.summary_belief_id,
    });
  const captures = data.captures.filter((c) => c.episode_id === id);
  const titles = [
    ...new Set(captures.map((c) => c.title.trim()).filter(Boolean)),
  ].slice(0, 5);
  const summary = `${episode.actor === "maya" ? "Maya" : "The agent"} recorded ${captures.length} capture${captures.length === 1 ? "" : "s"} in ${episode.app} on day ${episode.day}${titles.length ? `: ${titles.join("; ")}` : ""}.`;
  episode.ended_at = now;
  episode.summary = summary;
  if (captures.length) {
    const beliefId = ulid();
    const room: Room =
      episode.app === "mockloft" || episode.app === "landlord_chat"
        ? "Housing"
        : "Misc";
    data.beliefs.push({
      _id: beliefId,
      triple: { s: `episode:${id}`, p: "summary", o: summary },
      text: summary,
      kind: "summary",
      room,
      source: "screen",
      inferred: false,
      pinned: false,
      c0: DEFAULT_PARAMS.c0.screenEvent,
      evidence: captures.map((c) => c._id),
      created_day: data.day,
      history: [
        {
          day: data.day,
          event: "episode.ended",
          note: "Activity summary from capture metadata",
        },
      ],
    });
    for (const condition of CONDITIONS)
      data.beliefStates.push({
        _id: ulid(),
        condition,
        belief_id: beliefId,
        confidence: DEFAULT_PARAMS.c0.screenEvent,
        recalls: 0,
        last_recall_day: data.day,
        status: "active",
        superseded_by: null,
      });
    for (const capture of captures)
      data.edges.push({
        _id: ulid(),
        from: beliefId,
        to: capture._id,
        type: "evidence",
        weight: 1,
      });
    episode.summary_belief_id = beliefId;
    advanceMemory(data, data.day);
  }
  return EndEpisodeResponse.parse({
    episode_id: id,
    summary,
    summary_belief_id: episode.summary_belief_id,
  });
}
