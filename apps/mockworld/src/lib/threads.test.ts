import { describe, expect, it } from "vitest";
import type { Message } from "@cortex/schema";
import { groupThreads } from "./threads";

const m = (o: Partial<Message> & Pick<Message, "_id" | "thread_id" | "day">): Message => ({
  kind: "inbox",
  from: "Priya",
  to: "Maya",
  body: "hello",
  sent_by: "world",
  ...o,
});

describe("groupThreads", () => {
  it("groups by thread, newest first, with subject and participants", () => {
    const threads = groupThreads([
      m({ _id: "a", thread_id: "t1", day: 3, subject: "Dinner" }),
      m({ _id: "b", thread_id: "t1", day: 7, from: "Maya", to: "Priya" }),
      m({ _id: "c", thread_id: "t2", day: 9, kind: "landlord_chat", listing_id: "listing:5", from: "Dana" }),
    ]);
    expect(threads.map((t) => t.id)).toEqual(["t2", "t1"]);
    expect(threads[1]).toMatchObject({ subject: "Dinner", participants: ["Priya"], count: 2, lastDay: 7 });
    expect(threads[0]!.subject).toContain("listing:5");
  });
});
