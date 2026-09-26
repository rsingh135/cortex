/**
 * Deterministic force-directed layout for the memory graph, in 2D or 3D.
 *
 * The hex/sphere slots in memory-graph.ts and SpatialMemory.tsx place every node without overlap
 * but say nothing about how memories relate: two beliefs sharing evidence sit as far apart as two
 * strangers. This relaxes those slots under real forces so clusters emerge from the edges, the way
 * Obsidian's graph does, while staying reproducible — no Math.random anywhere, fixed iteration
 * order, and seed positions supplied by the caller.
 *
 * Repulsion uses a uniform-grid cutoff rather than a full n-body pass. Long-range structure comes
 * from group gravity instead, which is both cheaper and what keeps the rooms legible.
 */

export interface SimNode {
  id: string;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  /** Collision radius in layout units. */
  radius: number;
  /** Room, or any key whose members should cluster. */
  group: string;
  /** Held in place by a drag or a pin; forces move everything else around it. */
  pinned: boolean;
  /** Edge count; heavier nodes resist being pushed around. */
  degree: number;
}

export interface SimLink {
  source: string;
  target: string;
  /** 0..1; a firmer edge pulls its ends closer. */
  weight: number;
}

export interface Vec {
  x: number;
  y: number;
  z: number;
}

export interface SimOptions {
  dimensions: 2 | 3;
  /** Rest length of an edge at weight 1. */
  linkDistance: number;
  linkStrength: number;
  /** Pairwise push; larger spreads the graph out. */
  repulsion: number;
  /** Ignore pairs beyond this distance. Keep it a few link lengths. */
  repulsionCutoff: number;
  /** Pull toward the node's group center, which is what preserves the rooms. */
  groupGravity: number;
  groupCenters: Record<string, Vec>;
  /** Pull toward the graph center, so disconnected nodes do not drift away. */
  centerGravity: number;
  center: Vec;
  /** Velocity retained per tick. */
  damping: number;
  alphaDecay: number;
  alphaMin: number;
  collisionPasses: number;
}

export const DEFAULT_OPTIONS: SimOptions = {
  dimensions: 2,
  linkDistance: 78,
  linkStrength: 0.42,
  repulsion: 2600,
  repulsionCutoff: 260,
  groupGravity: 0.035,
  groupCenters: {},
  centerGravity: 0.008,
  center: { x: 0, y: 0, z: 0 },
  damping: 0.62,
  alphaDecay: 0.018,
  alphaMin: 0.002,
  collisionPasses: 2,
};

export interface SimulationSeed {
  id: string;
  x: number;
  y: number;
  z?: number;
  radius?: number;
  group?: string;
}

export interface Simulation {
  readonly nodes: readonly SimNode[];
  readonly alpha: number;
  /** Advances the simulation and returns the new alpha. */
  tick(steps?: number): number;
  /** Runs until cool or until `maxSteps`; returns the steps taken. */
  settle(maxSteps?: number): number;
  /** Restarts motion, e.g. after a drag or a filter change. */
  reheat(alpha?: number): void;
  position(id: string): Vec | undefined;
  pin(id: string, at?: Partial<Vec>): void;
  unpin(id: string): void;
  /** True while the layout is still moving. */
  readonly running: boolean;
}

/** Deterministic unit-ish offset so coincident nodes separate the same way on every run. */
function jitter(id: string): Vec {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const a = ((h >>> 0) % 1000) / 1000;
  const b = ((h >>> 10) % 1000) / 1000;
  const theta = a * Math.PI * 2;
  const phi = b * Math.PI;
  return {
    x: Math.cos(theta) * Math.sin(phi),
    y: Math.sin(theta) * Math.sin(phi),
    z: Math.cos(phi),
  };
}

export function createSimulation(
  seeds: readonly SimulationSeed[],
  links: readonly SimLink[],
  overrides: Partial<SimOptions> = {},
): Simulation {
  const options: SimOptions = { ...DEFAULT_OPTIONS, ...overrides };
  const flat = options.dimensions === 2;

  // Sorted so every force accumulates in the same order regardless of input ordering.
  const nodes: SimNode[] = [...seeds]
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .map((seed) => ({
      id: seed.id,
      x: seed.x,
      y: seed.y,
      z: flat ? 0 : (seed.z ?? 0),
      vx: 0,
      vy: 0,
      vz: 0,
      radius: seed.radius ?? 18,
      group: seed.group ?? "",
      pinned: false,
      degree: 0,
    }));
  const index = new Map(nodes.map((node, i) => [node.id, i]));

  const edges = links.flatMap((link) => {
    const a = index.get(link.source);
    const b = index.get(link.target);
    if (a === undefined || b === undefined || a === b) return [];
    return [{ a, b, weight: Math.min(1, Math.max(0, link.weight)) }];
  });
  for (const edge of edges) {
    nodes[edge.a]!.degree += 1;
    nodes[edge.b]!.degree += 1;
  }
  // Heavier nodes absorb less of each impulse, so hubs anchor and leaves swing.
  const mass = nodes.map((node) => 1 + Math.sqrt(node.degree));

  let alpha = 1;
  const cell = Math.max(1, options.repulsionCutoff);
  const cutoff2 = options.repulsionCutoff * options.repulsionCutoff;
  const buckets = new Map<string, number[]>();

  const key = (x: number, y: number, z: number) =>
    flat
      ? `${Math.floor(x / cell)},${Math.floor(y / cell)}`
      : `${Math.floor(x / cell)},${Math.floor(y / cell)},${Math.floor(z / cell)}`;

  function rebuildBuckets() {
    buckets.clear();
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i]!;
      const k = key(node.x, node.y, node.z);
      const bucket = buckets.get(k);
      if (bucket) bucket.push(i);
      else buckets.set(k, [i]);
    }
  }

  const neighborOffsets = (() => {
    const range = [-1, 0, 1];
    const out: [number, number, number][] = [];
    for (const dx of range)
      for (const dy of range)
        if (flat) out.push([dx, dy, 0]);
        else for (const dz of range) out.push([dx, dy, dz]);
    return out;
  })();

  function applyRepulsion() {
    rebuildBuckets();
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i]!;
      const cx = Math.floor(node.x / cell);
      const cy = Math.floor(node.y / cell);
      const cz = Math.floor(node.z / cell);
      for (const [dx, dy, dz] of neighborOffsets) {
        const bucket = buckets.get(
          flat ? `${cx + dx},${cy + dy}` : `${cx + dx},${cy + dy},${cz + dz}`,
        );
        if (!bucket) continue;
        for (const j of bucket) {
          // Each unordered pair is handled once, by its lower index.
          if (j <= i) continue;
          const other = nodes[j]!;
          let ax = node.x - other.x;
          let ay = node.y - other.y;
          let az = flat ? 0 : node.z - other.z;
          let d2 = ax * ax + ay * ay + az * az;
          if (d2 > cutoff2) continue;
          if (d2 < 1e-6) {
            const offset = jitter(node.id + other.id);
            ax = offset.x;
            ay = offset.y;
            az = flat ? 0 : offset.z;
            d2 = 1;
          }
          const d = Math.sqrt(d2);
          const force = (options.repulsion * alpha) / Math.max(d2, 4);
          const fx = (ax / d) * force;
          const fy = (ay / d) * force;
          const fz = (az / d) * force;
          node.vx += fx / mass[i]!;
          node.vy += fy / mass[i]!;
          other.vx -= fx / mass[j]!;
          other.vy -= fy / mass[j]!;
          if (!flat) {
            node.vz += fz / mass[i]!;
            other.vz -= fz / mass[j]!;
          }
        }
      }
    }
  }

  function applyLinks() {
    for (const { a, b, weight } of edges) {
      const from = nodes[a]!;
      const to = nodes[b]!;
      let ax = to.x - from.x;
      let ay = to.y - from.y;
      let az = flat ? 0 : to.z - from.z;
      let d = Math.sqrt(ax * ax + ay * ay + az * az);
      if (d < 1e-6) {
        const offset = jitter(from.id + to.id);
        ax = offset.x;
        ay = offset.y;
        az = flat ? 0 : offset.z;
        d = 1;
      }
      // A firmer edge wants a shorter rest length and pulls harder.
      const want = options.linkDistance * (1.25 - 0.25 * weight);
      const force =
        ((d - want) / d) * options.linkStrength * alpha * (0.5 + 0.5 * weight);
      const fx = ax * force;
      const fy = ay * force;
      const fz = az * force;
      from.vx += fx / mass[a]!;
      from.vy += fy / mass[a]!;
      to.vx -= fx / mass[b]!;
      to.vy -= fy / mass[b]!;
      if (!flat) {
        from.vz += fz / mass[a]!;
        to.vz -= fz / mass[b]!;
      }
    }
  }

  function applyGravity() {
    for (const node of nodes) {
      const group = options.groupCenters[node.group];
      if (group) {
        node.vx += (group.x - node.x) * options.groupGravity * alpha;
        node.vy += (group.y - node.y) * options.groupGravity * alpha;
        if (!flat) node.vz += (group.z - node.z) * options.groupGravity * alpha;
      }
      node.vx += (options.center.x - node.x) * options.centerGravity * alpha;
      node.vy += (options.center.y - node.y) * options.centerGravity * alpha;
      if (!flat)
        node.vz += (options.center.z - node.z) * options.centerGravity * alpha;
    }
  }

  /** Positional, not velocity-based, so glyphs never overlap even once the graph is cold. */
  function separate() {
    rebuildBuckets();
    for (let pass = 0; pass < options.collisionPasses; pass++) {
      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i]!;
        const cx = Math.floor(node.x / cell);
        const cy = Math.floor(node.y / cell);
        const cz = Math.floor(node.z / cell);
        for (const [dx, dy, dz] of neighborOffsets) {
          const bucket = buckets.get(
            flat ? `${cx + dx},${cy + dy}` : `${cx + dx},${cy + dy},${cz + dz}`,
          );
          if (!bucket) continue;
          for (const j of bucket) {
            if (j <= i) continue;
            const other = nodes[j]!;
            const want = node.radius + other.radius;
            let ax = node.x - other.x;
            let ay = node.y - other.y;
            let az = flat ? 0 : node.z - other.z;
            let d2 = ax * ax + ay * ay + az * az;
            if (d2 >= want * want) continue;
            if (d2 < 1e-6) {
              const offset = jitter(node.id + other.id);
              ax = offset.x;
              ay = offset.y;
              az = flat ? 0 : offset.z;
              d2 = 1;
            }
            const d = Math.sqrt(d2);
            const push = (want - d) / d / 2;
            const sx = ax * push;
            const sy = ay * push;
            const sz = az * push;
            if (!node.pinned) {
              node.x += sx;
              node.y += sy;
              if (!flat) node.z += sz;
            }
            if (!other.pinned) {
              other.x -= sx;
              other.y -= sy;
              if (!flat) other.z -= sz;
            }
          }
        }
      }
    }
  }

  function integrate() {
    for (const node of nodes) {
      if (node.pinned) {
        node.vx = 0;
        node.vy = 0;
        node.vz = 0;
        continue;
      }
      node.vx *= options.damping;
      node.vy *= options.damping;
      node.x += node.vx;
      node.y += node.vy;
      if (flat) {
        node.z = 0;
        node.vz = 0;
      } else {
        node.vz *= options.damping;
        node.z += node.vz;
      }
    }
  }

  function step() {
    applyRepulsion();
    applyLinks();
    applyGravity();
    integrate();
    separate();
    alpha = Math.max(0, alpha * (1 - options.alphaDecay));
    if (alpha < options.alphaMin) alpha = 0;
    return alpha;
  }

  return {
    nodes,
    get alpha() {
      return alpha;
    },
    get running() {
      return alpha > 0;
    },
    tick(steps = 1) {
      for (let i = 0; i < steps && alpha > 0; i++) step();
      return alpha;
    },
    settle(maxSteps = 400) {
      let taken = 0;
      while (alpha > 0 && taken < maxSteps) {
        step();
        taken += 1;
      }
      return taken;
    },
    reheat(next = 0.7) {
      alpha = Math.max(alpha, Math.min(1, next));
    },
    position(id) {
      const i = index.get(id);
      if (i === undefined) return undefined;
      const node = nodes[i]!;
      return { x: node.x, y: node.y, z: node.z };
    },
    pin(id, at) {
      const i = index.get(id);
      if (i === undefined) return;
      const node = nodes[i]!;
      node.pinned = true;
      if (at?.x !== undefined) node.x = at.x;
      if (at?.y !== undefined) node.y = at.y;
      if (at?.z !== undefined && !flat) node.z = at.z;
      node.vx = 0;
      node.vy = 0;
      node.vz = 0;
    },
    unpin(id) {
      const i = index.get(id);
      if (i !== undefined) nodes[i]!.pinned = false;
    },
  };
}
