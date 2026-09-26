import { describe, expect, it } from "vitest";
import { IPC, LISTEN_SHORTCUT } from "../src/shared/types";

describe("listen shortcut", () => {
  it("is Option+V on macOS (Electron spells Option as Alt) and has its own IPC channel", () => {
    expect(LISTEN_SHORTCUT).toBe("Alt+V");
    expect(IPC.startListening).toBe("mascot:start-listening");
    expect(new Set(Object.values(IPC)).size).toBe(Object.values(IPC).length);
  });
});
