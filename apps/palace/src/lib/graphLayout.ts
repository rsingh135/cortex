/**
 * Layout for the belief graph: six room-colored clusters floating in open space, the strongest
 * beliefs of each room as nodes, and the edges between them. Pure and deterministic (FNV-1a over
 * ids), so the same memory always draws the same graph and a reconnect never reshuffles it.
 */
import { ROOMS, type Room } from "@cortex/schema";
import { fnv1a } from "./hash";
import type { PalaceBelief, PalaceEdge, PalaceSnapshot, Vec3 } from "./types";
import { isShownInRoom } from "./types";

export const DEFAULT_PER_ROOM = 5;
/** Distance of each cluster centre from the origin. */
export const CLUSTER_RING_RADIUS = 11;
/** Radius of the ball a cluster's nodes are scattered in. */
export const CLUSTER_RADIUS = 2.6;
/** Nodes float around eye height so the walker passes through them. */
export const CLUSTER_HEIGHT = 1.9;
const MIN_NODE_GAP = 0.9;

export const ROOM_COLORS: Record<Room, string> = {
  Housing: "#f2b544",
  Work: "#5aa7ff",
  Social: "#ff7ab6",
  Health: "#4fd1a1",
  Errands: "#3fd3d3",
  Misc: "#b28cff",
};

export interface GraphCluster {
  room: Room;
  center: Vec3;
  color: string;
  count: number;
}

export interface GraphNode {
  id: string;
  room: Room;
  position: Vec3;
  color: string;
}

export interface GraphLink {
  id: string;
  from: string;
  to: string;
  kind: "derived_from" | "uses" | "supersedes" | "shared_evidence";
}

export interface GraphLayout {
  clusters: GraphCluster[];
  nodes: Map<string, GraphNode>;
  links: GraphLink[];
}

/** Angle of a room's cluster on the ring, matching the room palace so the story stays consistent. */
export function clusterAngle(room: Room): number {
  return (ROOMS.indexOf(room) * Math.PI) / 3;
}

export function clusterCenter(room: Room): Vec3 {
  const a = clusterAngle(room);
  return [Math.cos(a) * CLUSTER_RING_RADIUS, CLUSTER_HEIGHT, Math.sin(a) * CLUSTER_RING_RADIUS];
}

/** The beliefs the graph shows: alive, not summaries, the strongest `perRoom` of each room. */
export function selectGraphBeliefs(snapshot: PalaceSnapshot, perRoom = DEFAULT_PER_ROOM): PalaceBelief[] {
  const out: PalaceBelief[] = [];
  for (const room of ROOMS) {
    const inRoom = snapshot.beliefs
      .filter((b) => b.room === room && isShownInRoom(b) && b.kind !== "summary")
      .sort((a, b) => b.confidence - a.confidence || (a.id < b.id ? -1 : 1))
      .slice(0, perRoom);
    out.push(...inRoom);
  }
  return out;
}

/** Deterministic point inside a ball, from a hash. */
function scatter(id: string, radius: number): Vec3 {
  const h1 = fnv1a(`${id}:a`) / 0xffffffff;
  const h2 = fnv1a(`${id}:b`) / 0xffffffff;
  const h3 = fnv1a(`${id}:c`) / 0xffffffff;
  const theta = h1 * Math.PI * 2;
  const phi = Math.acos(2 * h2 - 1);
  const r = radius * Math.cbrt(0.25 + 0.75 * h3);
  return [r * Math.sin(phi) * Math.cos(theta), r * Math.cos(phi) * 0.55, r * Math.sin(phi) * Math.sin(theta)];
}

/** Push nodes of one cluster apart until none are closer than MIN_NODE_GAP. Deterministic order. */
function relax(points: Vec3[], iterations = 12): void {
  for (let it = 0; it < iterations; it++) {
    let moved = false;
    for (let i = 0; i < points.length; i++) {
      for (let j = i + 1; j < points.length; j++) {
        const a = points[i]!;
        const b = points[j]!;
        const dx = b[0] - a[0];
        const dy = b[1] - a[1];
        const dz = b[2] - a[2];
        const d = Math.hypot(dx, dy, dz) || 1e-6;
        if (d >= MIN_NODE_GAP) continue;
        const push = (MIN_NODE_GAP - d) / 2;
        const ux = (dx / d) * push;
        const uy = (dy / d) * push;
        const uz = (dz / d) * push;
        a[0] -= ux;
        a[1] -= uy;
        a[2] -= uz;
        b[0] += ux;
        b[1] += uy;
        b[2] += uz;
        moved = true;
      }
    }
    if (!moved) return;
  }
}

function edgeLinks(edges: readonly PalaceEdge[], ids: ReadonlySet<string>): GraphLink[] {
  const out: GraphLink[] = [];
  for (const e of edges) {
    if (e.type === "evidence") continue;
    if (!ids.has(e.from) || !ids.has(e.to)) continue;
    out.push({ id: e.id, from: e.from, to: e.to, kind: e.type });
  }
  return out;
}

/** Beliefs that share a screenshot are related even when no learner edge says so. */
function sharedEvidenceLinks(beliefs: readonly PalaceBelief[], existing: ReadonlySet<string>): GraphLink[] {
  const byCapture = new Map<string, string[]>();
  for (const b of beliefs) for (const c of b.evidence) byCapture.set(c, [...(byCapture.get(c) ?? []), b.id]);
  const seen = new Set<string>(existing);
  const out: GraphLink[] = [];
  for (const members of byCapture.values()) {
    const sorted = [...new Set(members)].sort();
    for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        const key = `${sorted[i]}|${sorted[j]}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ id: `shared:${key}`, from: sorted[i]!, to: sorted[j]!, kind: "shared_evidence" });
      }
    }
  }
  return out;
}

export function computeGraphLayout(snapshot: PalaceSnapshot, perRoom = DEFAULT_PER_ROOM): GraphLayout {
  const beliefs = selectGraphBeliefs(snapshot, perRoom);
  const nodes = new Map<string, GraphNode>();
  const clusters: GraphCluster[] = [];
  for (const room of ROOMS) {
    const members = beliefs.filter((b) => b.room === room).sort((a, b) => (a.id < b.id ? -1 : 1));
    const center = clusterCenter(room);
    clusters.push({ room, center, color: ROOM_COLORS[room], count: members.length });
    const points = members.map((b) => scatter(b.id, CLUSTER_RADIUS));
    relax(points);
    members.forEach((b, i) => {
      const p = points[i]!;
      nodes.set(b.id, { id: b.id, room, position: [center[0] + p[0], center[1] + p[1], center[2] + p[2]], color: ROOM_COLORS[room] });
    });
  }
  const ids = new Set(nodes.keys());
  const direct = edgeLinks(snapshot.edges, ids);
  const pairKeys = new Set(direct.map((l) => [l.from, l.to].sort().join("|")));
  const links = [...direct, ...sharedEvidenceLinks(beliefs, pairKeys)];
  return { clusters, nodes, links };
}

/** Where the walker starts: outside the ring, looking at the Housing cluster. */
export function graphSpawn(): { position: Vec3; yaw: number } {
  const [hx, , hz] = clusterCenter("Housing");
  const dist = CLUSTER_RING_RADIUS + 9;
  const a = Math.atan2(hz, hx);
  const position: Vec3 = [Math.cos(a) * dist, 1.7, Math.sin(a) * dist];
  // Yaw convention from FirstPersonControls: 0 looks down -z; yaw = atan2(-dx, -dz) toward the target.
  const yaw = Math.atan2(-(hx - position[0]), -(hz - position[2]));
  return { position, yaw };
}
