// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import MemoryExplorer from "../graph/MemoryExplorer";
import { graphDemo } from "./graph-demo";

vi.mock("next/dynamic", () => ({
  default: () =>
    function SpatialMemoryStub({ interactive }: { interactive: boolean }) {
      return createElement("div", {
        "data-testid": "spatial-memory",
        "data-interactive": String(interactive),
      });
    },
}));
vi.mock("./use-memory-snapshot", () => ({
  engineAddress: () => "http://localhost:4000",
  useMemorySnapshot: () => ({ snapshot: graphDemo(), status: "live" }),
}));

let root: Root;
let element: HTMLDivElement;
let previousOverflow: string;

function button(label: string): HTMLButtonElement {
  const found = Array.from(element.querySelectorAll("button")).find(
    (candidate) =>
      candidate.getAttribute("aria-label") === label ||
      candidate.textContent?.trim().startsWith(label),
  );
  if (!found) throw new Error(`Button not found: ${label}`);
  return found;
}
async function click(target: HTMLButtonElement) {
  await act(async () => {
    target.focus();
    target.click();
  });
}

beforeEach(async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  previousOverflow = document.body.style.overflow;
  document.body.style.overflow = "auto";
  element = document.createElement("div");
  document.body.append(element);
  root = createRoot(element);
  await act(async () => {
    root.render(createElement(MemoryExplorer));
  });
});
afterEach(async () => {
  await act(async () => root.unmount());
  element.remove();
  document.body.style.overflow = previousOverflow;
  vi.unstubAllGlobals();
});

describe("brain explorer entry", () => {
  it("opens 3D from the orb and restores scrolling and landing focus on Escape", async () => {
    expect(element.querySelector('[role="dialog"]')).toBeNull();
    const orb = button("Explore the brain in 3D");
    await click(orb);
    const dialog = element.querySelector('[role="dialog"]');
    expect(dialog?.getAttribute("aria-modal")).toBe("true");
    expect(dialog?.getAttribute("aria-label")).toBe("Explore the brain");
    expect(
      dialog
        ?.querySelector('[data-testid="spatial-memory"]')
        ?.getAttribute("data-interactive"),
    ).toBe("true");
    expect(document.body.style.overflow).toBe("hidden");
    expect(document.activeElement).toBe(button("Exit brain"));

    await act(async () => {
      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
      );
    });
    expect(element.querySelector('[role="dialog"]')).toBeNull();
    expect(document.body.style.overflow).toBe("auto");
    expect(document.activeElement).toBe(orb);
  });

  it("opens the secondary entry directly in the 2D graph and exits by button", async () => {
    await click(button("Open 2D graph"));
    const dialog = element.querySelector('[role="dialog"]');
    expect(dialog?.getAttribute("aria-modal")).toBe("true");
    expect(
      dialog?.querySelector(
        'svg[aria-label="Interactive knowledge memory graph"]',
      ),
    ).not.toBeNull();
    expect(dialog?.querySelector('[data-testid="spatial-memory"]')).toBeNull();
    expect(
      dialog?.querySelector(
        '[aria-label="Memory view"] button[aria-pressed="true"]',
      )?.textContent,
    ).toContain("2D graph");
    expect(document.body.style.overflow).toBe("hidden");
    await click(button("Exit brain"));
    expect(element.querySelector('[role="dialog"]')).toBeNull();
    expect(document.body.style.overflow).toBe("auto");
  });

  it("toggles the dark and light appearance with an accessible action label", async () => {
    const main = element.querySelector("main")!;
    const darkClasses = main.className;
    await click(button("Switch to light mode"));
    expect(main.className).not.toBe(darkClasses);
    expect(button("Switch to dark mode")).toBe(document.activeElement);
    await click(button("Switch to dark mode"));
    expect(main.className).toBe(darkClasses);
    expect(button("Switch to light mode")).toBe(document.activeElement);
  });
});
