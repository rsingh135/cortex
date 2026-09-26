"use client";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { CONDITIONS, ROOMS, type Condition, type Room } from "@cortex/schema";
import { projectMemoryGraph, type MemoryGraphNode } from "../lib/memory-graph";
import { graphDemo } from "../lib/graph-demo";
import { engineAddress, useMemorySnapshot } from "../lib/use-memory-snapshot";
import { useForceLayout } from "../lib/use-force-layout";
import styles from "./memory.module.css";
import CortexMark from "./CortexMark";
import BrainOrb from "./BrainOrb";

const SpatialMemory = dynamic(() => import("./SpatialMemory"), {
  ssr: false,
  loading: () => <div className={styles.empty}>Opening your brain…</div>,
});
const COLORS: Record<Room, string> = {
  Housing: "#b5874f",
  Work: "#648d7b",
  Social: "#9c7ca6",
  Health: "#739ab0",
  Errands: "#b88678",
  Misc: "#888794",
};
const CONDITION_LABELS: Record<Condition, string> = {
  cortex: "Cortex",
  keep_all: "Keep everything",
  blur_by_age: "Blur by age",
};
const EMPTY = { beliefs: [], captures: [], procedures: [], edges: [] };
const MIN_ZOOM = 0.3;
const MAX_ZOOM = 4;
/** Labels would pile up when zoomed out, so only hubs and the focused thread keep theirs. */
const LABEL_ZOOM = 1.1;
const LABEL_DEGREE = 3;
const clampZoom = (zoom: number) =>
  Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
const percent = (value: number) => `${Math.round(value * 100)}%`;

export default function MemoryExplorer() {
  const [mode, setMode] = useState<"live" | "demo">("live");
  const [view, setView] = useState<"graph" | "palace">("palace");
  const [immersive, setImmersive] = useState(false);
  const [dark, setDark] = useState(true);
  const container = useRef<HTMLElement>(null);
  const exploreButton = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!immersive) return;
    const previousOverflow = document.body.style.overflow;
    const previousFocus = returnFocus.current ?? exploreButton.current;
    document.body.style.overflow = "hidden";
    closeButton.current?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setImmersive(false);
      }
      if (event.key !== "Tab") return;
      const controls = Array.from(
        container.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled), a[href], input, select:not(:disabled), [tabindex="0"]',
        ) ?? [],
      ).filter((element) => element.getClientRects().length);
      const first = controls[0],
        last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", keydown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", keydown);
      previousFocus?.focus();
    };
  }, [immersive]);
  const explore = () => {
    returnFocus.current = document.activeElement as HTMLElement | null;
    setImmersive(true);
  };
  const [condition, setCondition] = useState<Condition>("cortex");
  const [query, setQuery] = useState("");
  const [room, setRoom] = useState<Room | "all">("all");
  const [evidence, setEvidence] = useState(true);
  const [selectedId, select] = useState<string | null>(null);
  const [camera, setCamera] = useState({ x: 0, y: 0, zoom: 1 });
  const drag = useRef<{
    x: number;
    y: number;
    startX: number;
    startY: number;
  } | null>(null);
  const live = useMemorySnapshot(mode === "live", condition);
  const demo = useMemo(() => graphDemo(), []);
  const snapshot = mode === "demo" ? demo : live.snapshot;
  const payload = snapshot?.payload ?? EMPTY;
  const graph = useMemo(
    () =>
      projectMemoryGraph(payload, {
        showEvidence: evidence,
        search: query,
        room,
      }),
    [payload, evidence, query, room],
  );
  const full = useMemo(() => projectMemoryGraph(payload), [payload]);
  const byId = useMemo(
    () => new Map(full.nodes.map((node) => [node.id, node])),
    [full.nodes],
  );
  const selected = selectedId ? byId.get(selectedId) : undefined;
  const selectedEdges = full.edges.filter(
    (edge) => edge.from === selectedId || edge.to === selectedId,
  );

  // Degree drives glyph size and mass: a memory that everything leans on reads as a hub.
  const degree = useMemo(() => {
    const counts = new Map<string, number>();
    for (const edge of full.edges) {
      counts.set(edge.from, (counts.get(edge.from) ?? 0) + 1);
      counts.set(edge.to, (counts.get(edge.to) ?? 0) + 1);
    }
    return counts;
  }, [full.edges]);
  const radiusOf = useCallback(
    (node: MemoryGraphNode) => {
      const base =
        node.kind === "procedure" ? 16 : node.kind === "capture" ? 11 : 14;
      return base + Math.min(10, Math.sqrt(degree.get(node.id) ?? 0) * 3.4);
    },
    [degree],
  );

  // The simulation runs over every node, so filtering never rearranges what stays on screen.
  const seeds = useMemo(
    () =>
      full.nodes.map((node) => ({
        id: node.id,
        x: node.x,
        y: node.y,
        radius: radiusOf(node) + 12,
        group: node.room,
      })),
    [full.nodes, radiusOf],
  );
  const links = useMemo(
    () =>
      full.edges.map((edge) => ({
        source: edge.from,
        target: edge.to,
        weight: edge.weight,
      })),
    [full.edges],
  );
  const groupCenters = useMemo(
    () =>
      Object.fromEntries(
        ROOMS.map((name) => [
          name,
          { x: graph.roomCenters[name].x, y: graph.roomCenters[name].y, z: 0 },
        ]),
      ),
    [graph.roomCenters],
  );
  const layout = useForceLayout({
    seeds,
    links,
    options: {
      dimensions: 2,
      groupCenters,
      linkDistance: 94,
      repulsion: 3400,
      repulsionCutoff: 320,
      groupGravity: 0.03,
    },
    enabled: immersive && view === "graph",
  });
  const at = (id: string) => layout.position(id) ?? byId.get(id) ?? { x: 0, y: 0 };

  // Hover takes precedence over selection, the way a graph editor previews a thread.
  const [hoveredId, setHovered] = useState<string | null>(null);
  const focusId = hoveredId ?? selectedId;
  const focused = useMemo(() => {
    const ids = new Set<string>();
    if (!focusId) return ids;
    ids.add(focusId);
    for (const edge of full.edges) {
      if (edge.from === focusId) ids.add(edge.to);
      if (edge.to === focusId) ids.add(edge.from);
    }
    return ids;
  }, [focusId, full.edges]);

  const svgRef = useRef<SVGSVGElement>(null);
  const nodeDrag = useRef<{ id: string; moved: boolean } | null>(null);
  /** Cursor position in viewBox units; the SVG's own CTM handles letterboxing for us. */
  const toViewBox = (clientX: number, clientY: number) => {
    const svg = svgRef.current;
    const ctm = svg?.getScreenCTM();
    if (!svg || !ctm) return null;
    const point = svg.createSVGPoint();
    point.x = clientX;
    point.y = clientY;
    return point.matrixTransform(ctm.inverse());
  };
  const offset = (zoom: number) => ({
    x: (graph.width * (1 - zoom)) / 2,
    y: (graph.height * (1 - zoom)) / 2,
  });
  const toGraph = (clientX: number, clientY: number) => {
    const view = toViewBox(clientX, clientY);
    if (!view) return null;
    const shift = offset(camera.zoom);
    return {
      x: (view.x - camera.x - shift.x) / camera.zoom,
      y: (view.y - camera.y - shift.y) / camera.zoom,
    };
  };
  const list = graph.nodes.filter(
    (node) => !node.contextual && node.kind !== "capture",
  );
  const counts = Object.fromEntries(
    ROOMS.map((name) => [
      name,
      full.nodes.filter((node) => node.room === name && node.kind === "belief")
        .length,
    ]),
  );
  const selectNode = (id: string) => select(id);
  const switchMode = (next: "live" | "demo") => {
    setMode(next);
    select(null);
    setQuery("");
    setRoom("all");
    setCondition("cortex");
    setCamera({ x: 0, y: 0, zoom: 1 });
  };
  const changeScope = () => setCamera({ x: 0, y: 0, zoom: 1 });

  return (
    <main
      ref={container}
      className={`${styles.app} ${dark ? styles.dark : ""} ${immersive ? styles.immersive : ""}`}
      data-selected={Boolean(selected)}
      role={immersive ? "dialog" : undefined}
      aria-modal={immersive || undefined}
      aria-label={immersive ? "Explore the brain" : "Memory explorer"}
    >
      <header className={styles.header}>
        <Link href="/graph" className={styles.brand}>
          <span className={styles.logo}>
            <CortexMark />
          </span>{" "}
          cortex
          <span className={styles.brandDivider}>/</span>
          <span className={styles.brandSub}>memory explorer</span>
        </Link>
        <div className={styles.headerRight}>
          <button
            className={styles.themeButton}
            onClick={() => setDark((value) => !value)}
            aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
          >
            {dark ? "☼" : "☾"}
          </button>
          {immersive && (
            <button
              ref={closeButton}
              className={styles.exitButton}
              onClick={() => setImmersive(false)}
            >
              Exit brain <kbd>Esc</kbd> ×
            </button>
          )}
          <span
            className={`${styles.connection} ${mode === "demo" ? styles.demo : live.status === "live" ? styles.connected : ""}`}
          >
            <i />
            {mode === "demo"
              ? "Demo data"
              : live.status === "live"
                ? "Live memory"
                : live.status === "connecting"
                  ? "Connecting…"
                  : "Reconnecting…"}
          </span>
          <div className={styles.segment} aria-label="Data source">
            <button
              aria-pressed={mode === "live"}
              onClick={() => switchMode("live")}
            >
              Live
            </button>
            <button
              aria-pressed={mode === "demo"}
              onClick={() => switchMode("demo")}
            >
              Demo
            </button>
          </div>
        </div>
      </header>
      {
        <section className={styles.brainLanding} hidden={immersive}>
          <p className={styles.eyebrow}>A SPACE FOR EVERYTHING YOU KNOW</p>
          <h1>Your brain.</h1>
          <p className={styles.brainSubtitle}>
            Every memory. Every connection. A world to explore.
          </p>
          <button
            className={styles.orbButton}
            aria-label="Explore the brain in 3D"
            onClick={() => {
              setView("palace");
              explore();
            }}
          >
            <BrainOrb />
          </button>
          <div className={styles.brainActions}>
            <button
              ref={exploreButton}
              className={styles.exploreButton}
              onClick={() => {
                setView("palace");
                explore();
              }}
            >
              Explore the brain <span>↗</span>
            </button>
            <button
              className={styles.secondaryExplore}
              onClick={() => {
                setView("graph");
                explore();
              }}
            >
              Open 2D graph <span>→</span>
            </button>
          </div>
          <div className={styles.brainStats}>
            <span>
              <strong>{payload.beliefs.length}</strong> memories
            </span>
            <i />
            <span>
              <strong>{full.edges.length}</strong> connections
            </span>
            <i />
            <span>
              Day <strong>{snapshot?.day ?? "—"}</strong>
            </span>
          </div>
          <p className={styles.landingNote}>
            {mode === "demo"
              ? "Exploring an illustrative brain. Your live memory stays separate."
              : snapshot
                ? "Connected to Atlas. New memories appear as you capture episodes."
                : "Connecting to your memory engine. You can explore Demo while it connects."}
          </p>
        </section>
      }
      <div className={styles.workspace} hidden={!immersive}>
        <aside className={styles.sidebar} aria-label="Find memories">
          <label className={styles.search}>
            <span aria-hidden="true">⌕</span>
            <input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                changeScope();
              }}
              placeholder="Find a memory…"
              aria-label="Search memories"
            />
            {query && (
              <button aria-label="Clear search" onClick={() => setQuery("")}>
                ×
              </button>
            )}
          </label>
          <p className={styles.sectionLabel}>
            ROOMS <span>{ROOMS.length}</span>
          </p>
          <nav aria-label="Memory rooms" className={styles.rooms}>
            <button
              aria-pressed={room === "all"}
              onClick={() => {
                setRoom("all");
                changeScope();
              }}
            >
              <span className={styles.allRooms}>▦</span> All rooms{" "}
              <span>{payload.beliefs.length}</span>
            </button>
            {ROOMS.map((name) => (
              <button
                key={name}
                aria-pressed={room === name}
                onClick={() => {
                  setRoom(name);
                  changeScope();
                }}
              >
                <i style={{ background: COLORS[name] }} />
                {name}
                <span>{counts[name]}</span>
              </button>
            ))}
          </nav>
          <div className={styles.listHeader}>
            <p className={styles.sectionLabel}>
              {query ? "SEARCH RESULTS" : "MEMORIES"}
            </p>
            <span>{list.length}</span>
          </div>
          <div className={styles.memoryList}>
            {list.map((node) => (
              <button
                key={node.id}
                className={selectedId === node.id ? styles.selectedItem : ""}
                onClick={() => selectNode(node.id)}
              >
                <span
                  className={styles.listIcon}
                  style={{ color: COLORS[node.room] }}
                >
                  {node.kind === "procedure" ? "◇" : "●"}
                </span>
                <span>
                  {node.label}
                  <small>
                    {node.kind === "belief"
                      ? `${node.source.kind} · ${percent(node.source.confidence)}`
                      : "workflow"}
                  </small>
                </span>
              </button>
            ))}
            {!list.length && (
              <p className={styles.listEmpty}>
                {query
                  ? "No matching memories. Try another word or room."
                  : "Memories will appear here as episodes are captured."}
              </p>
            )}
          </div>
          <div className={styles.sidebarFoot}>
            <span>◌</span>
            <p>
              {mode === "demo"
                ? "An illustrative day in Maya’s memory. No data is saved to Atlas."
                : "Connected to your memory engine. Read-only exploration."}
            </p>
          </div>
        </aside>
        <section
          className={styles.canvasPanel}
          aria-label="Memory visualization"
        >
          <div className={styles.toolbar}>
            <div className={styles.segment} aria-label="Memory view">
              <button
                aria-pressed={view === "graph"}
                onClick={() => setView("graph")}
              >
                ⌘ &nbsp; 2D graph
              </button>
              <button
                aria-pressed={view === "palace"}
                onClick={() => setView("palace")}
              >
                ◇ &nbsp; 3D graph
              </button>
            </div>
            <div className={styles.toolbarRight}>
              <label>
                <input
                  type="checkbox"
                  checked={evidence}
                  onChange={(event) => setEvidence(event.target.checked)}
                />{" "}
                Evidence
              </label>
              <select
                aria-label="Memory strategy"
                value={condition}
                disabled={mode === "demo"}
                onChange={(event) => {
                  setCondition(event.target.value as Condition);
                  select(null);
                }}
              >
                {CONDITIONS.map((item) => (
                  <option key={item} value={item}>
                    {CONDITION_LABELS[item]}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className={styles.canvas}>
            {!full.nodes.length ? (
              <div className={styles.empty}>
                <span className={styles.emptySymbol}>◌</span>
                <h2>
                  {snapshot
                    ? "A place for your first memory."
                    : "Waiting for your memory engine."}
                </h2>
                <p>
                  {snapshot
                    ? "Capture an episode to start connecting memories and their evidence."
                    : "Start the engine on port 4000. This view reconnects automatically."}
                </p>
                <button onClick={() => switchMode("demo")}>
                  Explore demo memories <span>↗</span>
                </button>
              </div>
            ) : !graph.nodes.length ? (
              <div className={styles.empty}>
                <h2>No memories in this view</h2>
                <p>Try another search or clear the room filter.</p>
                <button
                  onClick={() => {
                    setQuery("");
                    setRoom("all");
                  }}
                >
                  Clear filters
                </button>
              </div>
            ) : view === "palace" ? (
              <SpatialMemory
                nodes={graph.nodes}
                layoutNodes={full.nodes}
                layoutEdges={full.edges}
                interactive={immersive}
                onExplore={explore}
                edges={graph.edges}
                selectedId={selectedId}
                onSelect={selectNode}
              />
            ) : (
              <svg
                ref={svgRef}
                className={styles.graph}
                style={{ touchAction: immersive ? "none" : "pan-y" }}
                viewBox={`0 0 ${graph.width} ${graph.height}`}
                role="group"
                aria-label="Interactive knowledge memory graph"
                onWheel={(event) => {
                  if (!immersive) return;
                  event.preventDefault();
                  const view = toViewBox(event.clientX, event.clientY);
                  const anchor = toGraph(event.clientX, event.clientY);
                  if (!view || !anchor) return;
                  // Keep the memory under the cursor pinned to the cursor while zooming.
                  const zoom = clampZoom(
                    camera.zoom * Math.exp(-event.deltaY * 0.0015),
                  );
                  const shift = offset(zoom);
                  setCamera({
                    zoom,
                    x: view.x - zoom * anchor.x - shift.x,
                    y: view.y - zoom * anchor.y - shift.y,
                  });
                }}
                onPointerDown={(event) => {
                  if (!immersive) return;
                  if ((event.target as Element).closest("[data-node]")) return;
                  event.currentTarget.setPointerCapture(event.pointerId);
                  drag.current = {
                    x: event.clientX,
                    y: event.clientY,
                    startX: camera.x,
                    startY: camera.y,
                  };
                }}
                onPointerMove={(event) => {
                  if (nodeDrag.current) {
                    const point = toGraph(event.clientX, event.clientY);
                    if (point) {
                      layout.moveDrag(point);
                      nodeDrag.current.moved = true;
                    }
                    return;
                  }
                  if (!drag.current) return;
                  const scale =
                    graph.width /
                    event.currentTarget.getBoundingClientRect().width;
                  setCamera((previous) => ({
                    ...previous,
                    x:
                      drag.current!.startX +
                      (event.clientX - drag.current!.x) * scale,
                    y:
                      drag.current!.startY +
                      (event.clientY - drag.current!.y) * scale,
                  }));
                }}
                onPointerUp={() => {
                  if (nodeDrag.current) {
                    // A press that never moved is a click, so it selects instead of dragging.
                    if (!nodeDrag.current.moved)
                      selectNode(nodeDrag.current.id);
                    layout.endDrag();
                    nodeDrag.current = null;
                  }
                  drag.current = null;
                }}
                onPointerCancel={() => {
                  if (nodeDrag.current) {
                    layout.endDrag();
                    nodeDrag.current = null;
                  }
                  drag.current = null;
                }}
              >
                <g
                  transform={`translate(${camera.x + offset(camera.zoom).x} ${camera.y + offset(camera.zoom).y}) scale(${camera.zoom})`}
                >
                  {ROOMS.map((name) => (
                    <g
                      key={name}
                      opacity={room !== "all" && name !== room ? 0.25 : 1}
                    >
                      <circle
                        cx={graph.roomCenters[name].x}
                        cy={graph.roomCenters[name].y}
                        r={145}
                        fill={COLORS[name]}
                        opacity=".055"
                      />
                      <text
                        x={graph.roomCenters[name].x}
                        y={graph.roomCenters[name].y - 163}
                        textAnchor="middle"
                        className={styles.roomLabel}
                        fill={COLORS[name]}
                      >
                        {name.toUpperCase()}
                      </text>
                    </g>
                  ))}
                  {graph.edges.map((edge) => {
                    const from = byId.get(edge.from),
                      to = byId.get(edge.to);
                    if (!from || !to) return null;
                    const a = at(edge.from),
                      b = at(edge.to);
                    const active =
                      focusId === edge.from || focusId === edge.to;
                    return (
                      <line
                        key={edge.id}
                        x1={a.x}
                        y1={a.y}
                        x2={b.x}
                        y2={b.y}
                        stroke={active ? COLORS[from.room] : "#c8c5ba"}
                        strokeWidth={
                          active ? 2.2 + edge.weight : 0.9 + edge.weight * 0.9
                        }
                        opacity={focusId && !active ? 0.08 : active ? 0.9 : 0.45}
                        strokeLinecap="round"
                        strokeDasharray={
                          edge.type === "derived_from" ? "5 5" : undefined
                        }
                      >
                        <title>
                          {edge.type.replaceAll("_", " ")}: {from.label} →{" "}
                          {to.label}
                        </title>
                      </line>
                    );
                  })}
                  {graph.nodes.map((node) => {
                    const point = at(node.id);
                    const radius = radiusOf(node);
                    const isFocus = focusId === node.id;
                    const dimmed = Boolean(focusId) && !focused.has(node.id);
                    const labelled =
                      isFocus ||
                      focused.has(node.id) ||
                      camera.zoom >= LABEL_ZOOM ||
                      (degree.get(node.id) ?? 0) >= LABEL_DEGREE;
                    return (
                      <g
                        key={node.id}
                        data-node={node.id}
                        transform={`translate(${point.x} ${point.y})`}
                        className={styles.node}
                        style={{ cursor: immersive ? "grab" : "pointer" }}
                        tabIndex={0}
                        role="button"
                        aria-label={`${node.label}, ${node.kind}, ${node.room}`}
                        aria-pressed={selectedId === node.id}
                        onPointerDown={(event) => {
                          if (!immersive) return;
                          event.stopPropagation();
                          const start = toGraph(event.clientX, event.clientY);
                          if (!start) return;
                          event.currentTarget.ownerSVGElement?.setPointerCapture(
                            event.pointerId,
                          );
                          nodeDrag.current = { id: node.id, moved: false };
                          layout.beginDrag(node.id, start);
                        }}
                        onClick={() => {
                          if (!immersive) selectNode(node.id);
                        }}
                        onPointerEnter={() => setHovered(node.id)}
                        onPointerLeave={() =>
                          setHovered((current) =>
                            current === node.id ? null : current,
                          )
                        }
                        onFocus={() => setHovered(node.id)}
                        onBlur={() =>
                          setHovered((current) =>
                            current === node.id ? null : current,
                          )
                        }
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            selectNode(node.id);
                          }
                        }}
                        opacity={dimmed ? 0.14 : node.contextual ? 0.62 : 1}
                      >
                        <title>{node.label}</title>
                        {isFocus && (
                          <circle
                            r={radius + 9}
                            fill="none"
                            stroke={COLORS[node.room]}
                            strokeWidth="1.5"
                            strokeDasharray="3 4"
                          />
                        )}
                        {node.kind === "capture" ? (
                          <rect
                            x={-radius * 0.78}
                            y={-radius * 0.62}
                            width={radius * 1.56}
                            height={radius * 1.24}
                            rx="4"
                            fill="#fff"
                            stroke={COLORS[node.room]}
                            strokeWidth="1.5"
                          />
                        ) : node.kind === "procedure" ? (
                          <path
                            d={`M0 ${-radius}L${radius} 0L0 ${radius}L${-radius} 0Z`}
                            fill={COLORS[node.room]}
                            stroke="white"
                            strokeWidth="3"
                          />
                        ) : (
                          <>
                            <circle
                              r={radius}
                              fill={COLORS[node.room]}
                              opacity={Math.max(0.4, node.source.confidence)}
                              stroke="white"
                              strokeWidth="3"
                            />
                            <circle r={radius * 0.28} fill="white" opacity=".85" />
                          </>
                        )}
                        {labelled && (
                          <text
                            y={radius + 16}
                            textAnchor="middle"
                            className={styles.nodeLabel}
                          >
                            {node.label.length > 24
                              ? `${node.label.slice(0, 23)}…`
                              : node.label}
                          </text>
                        )}
                      </g>
                    );
                  })}
                </g>
              </svg>
            )}
            {full.nodes.length > 0 && (
              <div className={styles.graphBottom}>
                <div className={styles.legend}>
                  <span>● Memory</span>
                  <span>▱ Evidence</span>
                  <span>◇ Workflow</span>
                </div>
                {view === "graph" && (
                  <div className={styles.zoom}>
                    <button
                      aria-label="Zoom out"
                      onClick={() =>
                        setCamera((c) => ({
                          ...c,
                          zoom: clampZoom(c.zoom / 1.2),
                        }))
                      }
                    >
                      −
                    </button>
                    <button
                      aria-label="Reset graph view"
                      onClick={() => setCamera({ x: 0, y: 0, zoom: 1 })}
                    >
                      {Math.round(camera.zoom * 100)}%
                    </button>
                    <button
                      aria-label="Zoom in"
                      onClick={() =>
                        setCamera((c) => ({
                          ...c,
                          zoom: clampZoom(c.zoom * 1.2),
                        }))
                      }
                    >
                      +
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
          <div className={styles.canvasFoot}>
            <span>
              {view === "graph"
                ? immersive
                  ? "Drag a memory to move it · Drag the background to pan · Scroll to zoom · Hover to follow a thread"
                  : "Select a memory · Open Explore the brain for full controls"
                : immersive
                  ? "Drag to rotate · Pinch to zoom · Right-drag to pan · Esc to exit"
                  : "Scroll the page freely · Open Explore the brain to navigate"}
            </span>
            <span>
              {graph.nodes.length} objects in view
              {query || room !== "all" ? " · linked context included" : ""}
            </span>
          </div>
        </section>
        <aside className={styles.inspector} aria-label="Memory details">
          {selected ? (
            <>
              <div className={styles.inspectorTitle}>
                <p className={styles.sectionLabel}>MEMORY DETAILS</p>
                <button
                  aria-label="Close memory details"
                  onClick={() => select(null)}
                >
                  ×
                </button>
              </div>
              <div
                className={styles.detailBadge}
                style={
                  { "--room-color": COLORS[selected.room] } as CSSProperties
                }
              >
                {selected.room}{" "}
                <span>
                  {" "}
                  /{" "}
                  {selected.kind === "belief"
                    ? selected.source.kind
                    : selected.kind === "capture"
                      ? "evidence"
                      : "workflow"}
                </span>
              </div>
              <h2>{selected.label}</h2>
              <NodeDetails node={selected} mode={mode} condition={condition} />
              <div className={styles.detailSection}>
                <p className={styles.sectionLabel}>
                  CONNECTIONS <span>{selectedEdges.length}</span>
                </p>
                {selectedEdges.map((edge) => {
                  const other = byId.get(
                    edge.from === selectedId ? edge.to : edge.from,
                  );
                  return other ? (
                    <button
                      className={styles.connectionItem}
                      key={edge.id}
                      onClick={() => select(other.id)}
                    >
                      <small>
                        {edge.type.replaceAll("_", " ")}{" "}
                        {edge.from === selectedId ? "→" : "←"}
                      </small>
                      <span>{other.label}</span>
                    </button>
                  ) : null;
                })}
                {!selectedEdges.length && (
                  <p className={styles.muted}>No recorded connections yet.</p>
                )}
              </div>
            </>
          ) : (
            <div className={styles.inspectorEmpty}>
              <span>↖</span>
              <p className={styles.eyebrow}>EVERY MEMORY HAS A STORY</p>
              <h2>Follow the thread.</h2>
              <p>
                Select a memory in either view to see its confidence, source,
                and evidence.
              </p>
              <div className={styles.tip}>
                <strong>One memory, two perspectives.</strong>
                <p>
                  Explore connections in 2D or enter the full-screen 3D brain.
                  Your selection stays with you.
                </p>
              </div>
            </div>
          )}
        </aside>
      </div>
      <footer className={styles.footer}>
        <span>Built around what matters to you.</span>
        <span>
          {mode === "demo"
            ? "ILLUSTRATIVE DATA · READ ONLY"
            : "ATLAS MEMORY · READ ONLY"}
        </span>
      </footer>
    </main>
  );
}

function NodeDetails({
  node,
  mode,
  condition,
}: {
  node: MemoryGraphNode;
  mode: "live" | "demo";
  condition: Condition;
}) {
  if (node.kind === "belief")
    return (
      <>
        <div className={styles.confidence}>
          <div>
            <span>Confidence</span>
            <strong>{percent(node.source.confidence)}</strong>
          </div>
          <div className={styles.track}>
            <i
              style={{
                width: percent(
                  Math.max(0, Math.min(1, node.source.confidence)),
                ),
                background: COLORS[node.room],
              }}
            />
          </div>
        </div>
        <dl className={styles.facts}>
          <div>
            <dt>Source</dt>
            <dd>{node.source.source.replaceAll("_", " ")}</dd>
          </div>
          <div>
            <dt>Created</dt>
            <dd>Day {node.source.created_day}</dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>{node.source.status}</dd>
          </div>
          <div>
            <dt>Evidence</dt>
            <dd>
              {node.source.evidence.length} capture
              {node.source.evidence.length === 1 ? "" : "s"}
            </dd>
          </div>
        </dl>
        {(node.source.pinned || node.source.inferred) && (
          <p className={styles.note}>
            {node.source.pinned
              ? "Pinned memory"
              : "Inferred from observed activity"}
          </p>
        )}
        <div className={styles.detailSection}>
          <p className={styles.sectionLabel}>HISTORY</p>
          {node.source.history
            .slice(-4)
            .reverse()
            .map((entry, i) => (
              <div className={styles.history} key={i}>
                <small>DAY {entry.day}</small>
                <p>{entry.note ?? entry.event}</p>
              </div>
            ))}
        </div>
      </>
    );
  if (node.kind === "capture")
    return (
      <>
        <p className={styles.muted}>
          {node.source.app} · Day {node.source.day}
        </p>
        {mode === "demo" ? (
          <div className={styles.previewEmpty}>
            ▱<p>Illustrative capture</p>
            <small>Real screenshots appear with live memory.</small>
          </div>
        ) : node.source.ceiling ? (
          <EvidenceImage
            id={node.id}
            condition={condition}
            title={node.label}
            version={`${node.source.ceiling}-${node.source.clarity}`}
          />
        ) : (
          <div className={styles.previewEmpty}>
            Image forgotten<p>The memory of this capture remains.</p>
          </div>
        )}
        <dl className={styles.facts}>
          <div>
            <dt>Clarity</dt>
            <dd>{percent(node.source.clarity)}</dd>
          </div>
          <div>
            <dt>Resolution</dt>
            <dd>{node.source.ceiling ?? "Forgotten"}</dd>
          </div>
          <div>
            <dt>Action</dt>
            <dd>{node.source.action.type}</dd>
          </div>
        </dl>
        {/^https?:\/\//.test(node.source.url) && (
          <a
            className={styles.sourceLink}
            href={node.source.url}
            target="_blank"
            rel="noreferrer"
          >
            Open original page ↗
          </a>
        )}
      </>
    );
  return (
    <>
      <p className={styles.muted}>{node.source.description}</p>
      <dl className={styles.facts}>
        <div>
          <dt>Status</dt>
          <dd>{node.source.status}</dd>
        </div>
        <div>
          <dt>Runs</dt>
          <dd>{node.source.runs}</dd>
        </div>
      </dl>
      <ol className={styles.steps}>
        {node.source.steps.map((step) => (
          <li key={step.n}>{step.do}</li>
        ))}
      </ol>
    </>
  );
}
function EvidenceImage({
  id,
  condition,
  title,
  version,
}: {
  id: string;
  condition: Condition;
  title: string;
  version: string;
}) {
  const [failedUrl, setFailedUrl] = useState("");
  const url = `${engineAddress()}/image/${encodeURIComponent(id)}?condition=${condition}&v=${encodeURIComponent(version)}`;
  return failedUrl === url ? (
    <div className={styles.previewEmpty}>
      Screenshot unavailable<p>The capture metadata is still available.</p>
    </div>
  ) : (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className={styles.evidenceImage}
    >
      {/* Engine image URLs are condition-specific and intentionally bypass Next's image cache. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt={title} onError={() => setFailedUrl(url)} />
      <span>Open screenshot ↗</span>
    </a>
  );
}
