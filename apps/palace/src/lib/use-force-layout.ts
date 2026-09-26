"use client";
/**
 * Runs the force layout for a graph view and repaints while it moves.
 *
 * Seeds come from the deterministic slot layout, so the first frame is already sensible and a
 * reduced-motion visitor can be handed the settled result with no animation at all. Positions
 * persist across snapshot updates: a new memory arriving joins the existing shape instead of
 * reshuffling every node the viewer had just learned to find.
 *
 * Positions are published as state rather than read off the simulation during render, so nothing
 * here touches a ref while rendering. The animation loop lives on a ref and is nudged awake by the
 * drag and reheat callbacks, which is why no effect ever calls setState synchronously.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createSimulation,
  type SimLink,
  type SimOptions,
  type Simulation,
  type SimulationSeed,
  type Vec,
} from "./force";

export interface ForceLayoutInput {
  /** Every node in the graph, filtered or not, so hiding records never moves the survivors. */
  seeds: readonly SimulationSeed[];
  links: readonly SimLink[];
  options?: Partial<SimOptions>;
  /** False parks the layout at its current positions, e.g. while the view is not interactive. */
  enabled?: boolean;
}

export interface ForceLayout {
  /** Undefined until the first frame publishes; callers fall back to the seed position. */
  position(id: string): Vec | undefined;
  running: boolean;
  dragging: string | null;
  beginDrag(id: string, at: Partial<Vec>): void;
  moveDrag(at: Partial<Vec>): void;
  endDrag(): void;
  reheat(alpha?: number): void;
}

interface Engine {
  simulation: Simulation;
  dragging: string | null;
  /** Pending animation frame, or 0 when the loop is parked. */
  raf: number;
  alive: boolean;
  wake(): void;
}

const NO_POSITIONS: ReadonlyMap<string, Vec> = new Map();

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function useForceLayout({
  seeds,
  links,
  options,
  enabled = true,
}: ForceLayoutInput): ForceLayout {
  const remembered = useRef<Map<string, Vec>>(new Map());
  const engine = useRef<Engine | null>(null);
  const [positions, setPositions] =
    useState<ReadonlyMap<string, Vec>>(NO_POSITIONS);
  const [running, setRunning] = useState(false);
  const [dragging, setDragging] = useState<string | null>(null);

  // Rebuild only when the graph's shape or the force parameters change, not every snapshot tick.
  const signature = useMemo(
    () =>
      JSON.stringify([
        seeds.map((seed) => seed.id).sort(),
        links.map((link) => `${link.source}>${link.target}`).sort(),
        options ?? null,
      ]),
    [seeds, links, options],
  );

  useEffect(() => {
    const placed = seeds.map((seed) => {
      const previous = remembered.current.get(seed.id);
      return previous ? { ...seed, ...previous } : seed;
    });
    const simulation = createSimulation(placed, links, options);
    if (prefersReducedMotion()) simulation.settle();

    const remember = () => {
      for (const node of simulation.nodes)
        remembered.current.set(node.id, {
          x: node.x,
          y: node.y,
          z: node.z,
        });
    };
    const publish = () =>
      new Map(
        simulation.nodes.map((node) => [
          node.id,
          { x: node.x, y: node.y, z: node.z },
        ]),
      );
    remember();

    const self: Engine = {
      simulation,
      dragging: null,
      raf: 0,
      alive: true,
      wake: () => {},
    };
    const pump = () => {
      if (!self.alive) return;
      simulation.tick();
      remember();
      setPositions(publish());
      const moving = simulation.running || Boolean(self.dragging);
      setRunning(moving);
      self.raf = moving && enabled ? requestAnimationFrame(pump) : 0;
    };
    self.wake = () => {
      if (!self.alive || self.raf || !enabled) return;
      self.raf = requestAnimationFrame(pump);
    };
    engine.current = self;
    // The first frame publishes positions, so the effect itself never calls setState.
    self.raf = requestAnimationFrame(pump);

    return () => {
      self.alive = false;
      if (self.raf) cancelAnimationFrame(self.raf);
      if (engine.current === self) engine.current = null;
    };
    // `signature` stands in for seeds, links and options; positions carry over via `remembered`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, enabled]);

  const reheat = useCallback((alpha = 0.7) => {
    const self = engine.current;
    if (!self) return;
    self.simulation.reheat(alpha);
    self.wake();
  }, []);

  const beginDrag = useCallback((id: string, at: Partial<Vec>) => {
    const self = engine.current;
    if (!self) return;
    self.dragging = id;
    setDragging(id);
    self.simulation.pin(id, at);
    self.simulation.reheat(0.45);
    self.wake();
  }, []);

  const moveDrag = useCallback((at: Partial<Vec>) => {
    const self = engine.current;
    if (!self?.dragging) return;
    self.simulation.pin(self.dragging, at);
    self.simulation.reheat(0.35);
    self.wake();
  }, []);

  const endDrag = useCallback(() => {
    const self = engine.current;
    if (!self?.dragging) return;
    self.simulation.unpin(self.dragging);
    self.dragging = null;
    setDragging(null);
    self.simulation.reheat(0.3);
    self.wake();
  }, []);

  const position = useCallback(
    (id: string) => positions.get(id),
    [positions],
  );

  return { position, running, dragging, beginDrag, moveDrag, endDrag, reheat };
}
