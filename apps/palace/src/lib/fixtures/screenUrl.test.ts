import { describe, expect, it } from "vitest";
import { generateFixture } from "./generate";
import { clearScreenUrls, fixtureScreenKey, isFixtureScreenKey, parseFixtureScreenKey, peekScreenUrl, requestScreenUrl, resolveScreenUrlNow } from "./screenUrl";

describe("fixture screen keys", () => {
  it("round-trips every capture of the fixture and needs no DOM to build", () => {
    const snapshot = generateFixture(42);
    for (const c of snapshot.captures) {
      const key = fixtureScreenKey(c, 42);
      if (c.ceiling === null) {
        expect(key).toBeNull();
        continue;
      }
      expect(key).not.toBeNull();
      if (key === null) continue;
      expect(isFixtureScreenKey(key)).toBe(true);
      expect(parseFixtureScreenKey(key)).toEqual({ seed: 42, capture: { id: c.id, app: c.app, title: c.title, ceiling: c.ceiling } });
    }
  });

  it("changes with the seed and the ceiling, so a sweep invalidates the texture", () => {
    const capture = { id: "cap_1", app: "inbox" as const, title: "Inbox: lease", ceiling: "L1" as const };
    expect(fixtureScreenKey(capture, 1)).not.toBe(fixtureScreenKey(capture, 2));
    expect(fixtureScreenKey(capture, 1)).not.toBe(fixtureScreenKey({ ...capture, ceiling: "L2" }, 1));
  });

  it("survives titles and ids with delimiters", () => {
    const capture = { id: "cap:odd/1", app: "landlord_chat" as const, title: "Re: 2BR — “quiet”? yes: maybe", ceiling: "L0" as const };
    const key = fixtureScreenKey(capture, 7);
    expect(key).not.toBeNull();
    if (key === null) return;
    expect(parseFixtureScreenKey(key)?.capture).toEqual(capture);
  });

  it("rejects malformed keys and plain URLs", () => {
    expect(parseFixtureScreenKey("https://engine.local/image/cap_1")).toBeNull();
    expect(parseFixtureScreenKey("fixture:42:L9:inbox:cap:t")).toBeNull();
    expect(parseFixtureScreenKey("fixture:42:L0:notanapp:cap:t")).toBeNull();
    expect(parseFixtureScreenKey("fixture:x:L0:inbox:cap:t")).toBeNull();
    expect(parseFixtureScreenKey("fixture:42:L0:inbox")).toBeNull();
    expect(isFixtureScreenKey("data:image/webp;base64,AAAA")).toBe(false);
  });

  it("settles to null without a document and tells waiters once", () => {
    clearScreenUrls();
    const key = fixtureScreenKey({ id: "cap_2", app: "calendar", title: "Week", ceiling: "L2" }, 3);
    if (key === null) throw new Error("expected a key");
    expect(peekScreenUrl(key)).toBeNull();
    let calls = 0;
    const stop = requestScreenUrl(key, () => calls++);
    // No window under vitest node: nothing is scheduled, so resolve synchronously.
    expect(resolveScreenUrlNow(key)).toBeNull();
    expect(calls).toBe(1);
    expect(resolveScreenUrlNow(key)).toBeNull();
    expect(calls).toBe(1);
    stop();
  });
});
