import { ROOMS, type EdgeType, type Room, type Snapshot } from "@cortex/schema";
import type { z } from "zod";

export type MemorySnapshot = z.infer<typeof Snapshot>;
export type MemoryPayload = MemorySnapshot["payload"];
export type Point = { x: number; y: number };

export const GRAPH_WIDTH = 1200;
export const GRAPH_HEIGHT = 800;
/** Node centers stay at least this far apart; render glyphs with radius <= 18. */
export const NODE_SPACING = 72;

function roomCenters(width: number, height: number): Record<Room, Point> {
  return Object.fromEntries(
    ROOMS.map((room, i) => [
      room,
      {
        x: (((i % 3) + 0.5) * width) / 3,
        y: ((Math.floor(i / 3) + 0.5) * height) / 2,
      },
    ]),
  ) as Record<Room, Point>;
}

export const ROOM_CENTERS = roomCenters(GRAPH_WIDTH, GRAPH_HEIGHT);

interface NodeBase extends Point {
  id: string;
  label: string;
  room: Room;
  confidence?: number;
  clarity?: number;
  /** Included as a direct neighbor of a filter match, rather than matching the filter itself. */
  contextual: boolean;
}

export type MemoryGraphNode = NodeBase &
  (
    | { kind: "belief"; source: MemoryPayload["beliefs"][number] }
    | { kind: "capture"; source: MemoryPayload["captures"][number] }
    | { kind: "procedure"; source: MemoryPayload["procedures"][number] }
  );

export interface MemoryGraphEdge {
  id: string;
  from: string;
  to: string;
  type: EdgeType;
  weight: number;
  /** Evidence edges come directly from belief.evidence when no canonical edge exists. */
  origin: "canonical" | "evidence";
}

export interface MemoryGraph {
  nodes: MemoryGraphNode[];
  edges: MemoryGraphEdge[];
  matchedIds: string[];
  width: number;
  height: number;
  roomCenters: Record<Room, Point>;
}

export interface MemoryGraphOptions {
  showEvidence?: boolean;
  search?: string;
  room?: Room | "all";
}

const order = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const edgeKey = (from: string, to: string, type: EdgeType) =>
  JSON.stringify([from, to, type]);

/** No facts or relationships are invented: this projects the snapshot's records and links. */
export function projectMemoryGraph(
  payload: MemoryPayload,
  options: MemoryGraphOptions = {},
): MemoryGraph {
  const beliefById = new Map(
    payload.beliefs.map((belief) => [belief._id, belief]),
  );
  const captureIds = new Set(payload.captures.map((capture) => capture._id));
  const linkedBeliefs = new Map<string, Set<string>>();
  const linkRoom = (beliefId: string, captureId: string) => {
    if (!beliefById.has(beliefId) || !captureIds.has(captureId)) return;
    const links = linkedBeliefs.get(captureId) ?? new Set<string>();
    links.add(beliefId);
    linkedBeliefs.set(captureId, links);
  };
  for (const belief of payload.beliefs)
    for (const id of belief.evidence) linkRoom(belief._id, id);
  for (const edge of payload.edges) {
    linkRoom(edge.from, edge.to);
    linkRoom(edge.to, edge.from);
  }
  const captureRoom = (id: string): Room => {
    const counts = new Map<Room, number>();
    for (const beliefId of linkedBeliefs.get(id) ?? []) {
      const room = beliefById.get(beliefId)!.room;
      counts.set(room, (counts.get(room) ?? 0) + 1);
    }
    // Shared evidence uses the most represented room; ties follow the fixed room order.
    let best: Room = "Misc";
    let most = 0;
    for (const room of ROOMS)
      if ((counts.get(room) ?? 0) > most) {
        best = room;
        most = counts.get(room)!;
      }
    return best;
  };

  const base = { x: 0, y: 0, contextual: false };
  const nodes: MemoryGraphNode[] = [
    ...payload.beliefs.map((source) => ({
      ...base,
      id: source._id,
      kind: "belief" as const,
      label: source.text,
      room: source.room,
      confidence: source.confidence,
      source,
    })),
    ...payload.captures.map((source) => ({
      ...base,
      id: source._id,
      kind: "capture" as const,
      label: source.title || source.url || "Untitled capture",
      room: captureRoom(source._id),
      clarity: source.clarity,
      source,
    })),
    ...payload.procedures.map((source) => ({
      ...base,
      id: source._id,
      kind: "procedure" as const,
      label: source.name,
      room: source.room,
      source,
    })),
  ].sort((a, b) => order(a.id, b.id));
  const ids = new Set(nodes.map((node) => node.id));
  const edges = new Map<string, MemoryGraphEdge>();
  for (const edge of [...payload.edges].sort((a, b) => order(a._id, b._id))) {
    if (!ids.has(edge.from) || !ids.has(edge.to)) continue;
    const key = edgeKey(edge.from, edge.to, edge.type);
    if (!edges.has(key))
      edges.set(key, {
        id: edge._id,
        from: edge.from,
        to: edge.to,
        type: edge.type,
        weight: edge.weight,
        origin: "canonical",
      });
  }
  for (const belief of payload.beliefs)
    for (const captureId of belief.evidence) {
      if (!captureIds.has(captureId)) continue;
      const key = edgeKey(belief._id, captureId, "evidence");
      if (!edges.has(key))
        edges.set(key, {
          id: `evidence:${key}`,
          from: belief._id,
          to: captureId,
          type: "evidence",
          weight: 1,
          origin: "evidence",
        });
    }
  const orderedEdges = [...edges.values()].sort((a, b) =>
    order(edgeKey(a.from, a.to, a.type), edgeKey(b.from, b.to, b.type)),
  );

  // Layout is computed before filtering so searching or hiding evidence never moves surviving nodes.
  const groups = ROOMS.map((room) =>
    nodes.filter((node) => node.room === room),
  );
  const slots = hexSlots(Math.max(0, ...groups.map((group) => group.length)));
  const extentX = Math.max(0, ...slots.map((point) => Math.abs(point.x)));
  const extentY = Math.max(0, ...slots.map((point) => Math.abs(point.y)));
  const width = Math.max(GRAPH_WIDTH, Math.ceil(2 * extentX + 64) * 3);
  const height = Math.max(GRAPH_HEIGHT, Math.ceil(2 * extentY + 96) * 2);
  const centers = roomCenters(width, height);
  groups.forEach((group, roomIndex) =>
    group.forEach((node, index) => {
      const center = centers[ROOMS[roomIndex]];
      node.x = center.x + slots[index].x;
      node.y = center.y + slots[index].y;
    }),
  );

  const eligible = nodes.filter(
    (node) => options.showEvidence !== false || node.kind !== "capture",
  );
  const eligibleIds = new Set(eligible.map((node) => node.id));
  const eligibleEdges = orderedEdges.filter(
    (edge) => eligibleIds.has(edge.from) && eligibleIds.has(edge.to),
  );
  const terms =
    options.search?.trim().toLowerCase().split(/\s+/).filter(Boolean) ?? [];
  const matches = eligible.filter((node) => {
    if (options.room && options.room !== "all" && node.room !== options.room)
      return false;
    const text = searchableText(node);
    return terms.every((term) => text.includes(term));
  });
  const matchedIds = new Set(matches.map((node) => node.id));
  const visible = new Set(matchedIds);
  // Exactly one hop from the original matches, with directions preserved on rendered links.
  for (const edge of eligibleEdges) {
    if (matchedIds.has(edge.from)) visible.add(edge.to);
    if (matchedIds.has(edge.to)) visible.add(edge.from);
  }
  return {
    nodes: eligible
      .filter((node) => visible.has(node.id))
      .map((node) => ({ ...node, contextual: !matchedIds.has(node.id) })),
    edges: eligibleEdges.filter(
      (edge) => visible.has(edge.from) && visible.has(edge.to),
    ),
    matchedIds: [...matchedIds],
    width,
    height,
    roomCenters: centers,
  };
}

function searchableText(node: MemoryGraphNode): string {
  let detail: string;
  switch (node.kind) {
    case "belief":
      detail = [
        node.source.triple.s,
        node.source.triple.p,
        node.source.triple.o,
        node.source.kind,
        node.source.source,
        node.source.status,
      ].join(" ");
      break;
    case "capture":
      detail = [
        node.source.url,
        node.source.app,
        node.source.action.text ?? "",
      ].join(" ");
      break;
    case "procedure":
      detail = [
        node.source.description,
        node.source.status,
        ...node.source.steps.map((step) => step.do),
      ].join(" ");
      break;
  }
  return `${node.label} ${node.room} ${detail}`.toLowerCase();
}

/** Axial hexagons provide deterministic non-overlapping slots without a force simulation. */
function hexSlots(count: number): Point[] {
  if (!count) return [];
  const slots: Point[] = [{ x: 0, y: 0 }];
  const directions = [
    [1, 0],
    [1, -1],
    [0, -1],
    [-1, 0],
    [-1, 1],
    [0, 1],
  ];
  for (let ring = 1; slots.length < count; ring++) {
    let q = -ring;
    let r = ring;
    for (const [dq, dr] of directions)
      for (let step = 0; step < ring && slots.length < count; step++) {
        slots.push({
          x: NODE_SPACING * (q + r / 2),
          y: ((NODE_SPACING * Math.sqrt(3)) / 2) * r,
        });
        q += dq;
        r += dr;
      }
  }
  return slots;
}
