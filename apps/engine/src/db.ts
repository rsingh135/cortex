/** One MongoClient for the process. Collections typed from @cortex/schema. */
import { MongoClient, type Collection, type Db } from "mongodb";
import type {
  Belief,
  BeliefState,
  CalendarEvent,
  Capture,
  CaptureState,
  Clock,
  DailyStat,
  Decision,
  Edge,
  Episode,
  ImageLevel,
  Listing,
  Message,
  Procedure,
  Recall,
  VoiceNote,
} from "@cortex/schema";

export interface Collections {
  captures: Collection<Capture>;
  image_levels: Collection<ImageLevel>;
  beliefs: Collection<Belief>;
  edges: Collection<Edge>;
  procedures: Collection<Procedure>;
  decisions: Collection<Decision>;
  episodes: Collection<Episode>;
  recalls: Collection<Recall>;
  voice_notes: Collection<VoiceNote>;
  clock: Collection<Clock>;
  capture_state: Collection<CaptureState>;
  belief_state: Collection<BeliefState>;
  daily_stats: Collection<DailyStat>;
  listings: Collection<Listing>;
  messages: Collection<Message>;
  calendar_events: Collection<CalendarEvent>;
}

export function collections(db: Db): Collections {
  return {
    captures: db.collection("captures"),
    image_levels: db.collection("image_levels"),
    beliefs: db.collection("beliefs"),
    edges: db.collection("edges"),
    procedures: db.collection("procedures"),
    decisions: db.collection("decisions"),
    episodes: db.collection("episodes"),
    recalls: db.collection("recalls"),
    voice_notes: db.collection("voice_notes"),
    clock: db.collection("clock"),
    capture_state: db.collection("capture_state"),
    belief_state: db.collection("belief_state"),
    daily_stats: db.collection("daily_stats"),
    listings: db.collection("listings"),
    messages: db.collection("messages"),
    calendar_events: db.collection("calendar_events"),
  };
}

export async function connect(uri: string, dbName: string): Promise<{ client: MongoClient; db: Db; c: Collections }> {
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(dbName);
  return { client, db, c: collections(db) };
}
