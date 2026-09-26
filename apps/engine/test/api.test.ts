import { describe, expect, it } from "vitest";
import { createApp } from "../src/api/app.js";

const app = createApp({ fixtureMode: true, now: () => "2026-09-26T00:00:00.000Z" });

describe("engine http", () => {
  it("health is 200", async () => {
    const res = await app.request("/health");
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, fixture_mode: true });
  });
  it("valid recall body reaches the 501 stub", async () => {
    const res = await app.request("/recall", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ query: "budget", by: "agent", reason: "test" }) });
    expect(res.status).toBe(501);
    expect(await res.json()).toEqual({ error: "not implemented", route: "POST /recall" });
  });
  it("invalid body is 400 with issues", async () => {
    const res = await app.request("/ask", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({}) });
    expect(res.status).toBe(400);
    expect(await res.json()).toHaveProperty("issues");
  });
  it("fixture snapshot is an empty valid snapshot event", async () => {
    const res = await app.request("/snapshot?condition=cortex");
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ type: "snapshot", payload: { beliefs: [], captures: [] } });
  });
});
