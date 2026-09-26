"use client";

import { useEffect, useMemo, useRef, useState, type ComponentRef } from "react";
import {
  Canvas,
  useFrame,
  useThree,
  type ThreeEvent,
} from "@react-three/fiber";
import { Billboard, Text, Line, OrbitControls } from "@react-three/drei";
import { Vector3 } from "three";
import { ROOMS, type Room } from "@cortex/schema";
import type { MemoryGraphEdge, MemoryGraphNode } from "../lib/memory-graph";
import { createSimulation, type Vec } from "../lib/force";

type Point = [number, number, number];
const COLORS: Record<Room, string> = {
  Housing: "#d6b785",
  Work: "#92c5ab",
  Social: "#c7a2da",
  Health: "#8bbbd5",
  Errands: "#db9f90",
  Misc: "#b2b8d0",
};
interface Props {
  nodes: MemoryGraphNode[];
  layoutNodes: MemoryGraphNode[];
  /** Every edge, so the layout is stable while filters hide links. */
  layoutEdges: MemoryGraphEdge[];
  edges: MemoryGraphEdge[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  interactive: boolean;
  onExplore: () => void;
}
type Command = { type: "in" | "out" | "fit" | "focus"; sequence: number };

/**
 * Stable clusters preserve spatial memory while filters hide records.
 *
 * Room spheres only decide where a memory *starts*. The force solver then relaxes those seeds in
 * three dimensions, so what you see is shaped by the edges: shared evidence draws beliefs together
 * and hubs settle at the centre of their own cluster. It is settled in one pass rather than animated
 * because each edge here is its own line object, and rebuilding hundreds of line geometries every
 * frame costs more than the motion is worth. The 2D view carries the live simulation.
 */
/** Collision radius per glyph kind, a little larger than the mesh so nothing touches. */
function glyphRadius(node: MemoryGraphNode): number {
  return node.kind === "procedure" ? 0.46 : node.kind === "capture" ? 0.4 : 0.38;
}

function layout(nodes: MemoryGraphNode[], edges: MemoryGraphEdge[] = []) {
  const centers = new Map<Room, Point>();
  const seeds: {
    id: string;
    x: number;
    y: number;
    z: number;
    radius: number;
    group: string;
  }[] = [];
  for (const [index, room] of ROOMS.entries()) {
    const angle = (index * Math.PI * 2) / ROOMS.length;
    const center: Point = [
      Math.cos(angle) * 10,
      Math.sin(angle) * 7,
      (index % 2 ? 1 : -1) * 3,
    ];
    centers.set(room, center);
    const group = nodes
      .filter((node) => node.room === room)
      .sort((a, b) => a.id.localeCompare(b.id));
    group.forEach((node, i) => {
      const phi = i * 2.39996323;
      const vertical = 1 - (2 * (i + 0.5)) / Math.max(1, group.length);
      const radius = 1.4 + Math.sqrt(group.length) * 0.6;
      const ring = Math.sqrt(1 - vertical * vertical) * radius;
      seeds.push({
        id: node.id,
        x: center[0] + Math.cos(phi) * ring,
        y: center[1] + vertical * radius,
        z: center[2] + Math.sin(phi) * ring,
        radius: glyphRadius(node),
        group: room,
      });
    });
  }

  const present = new Set(seeds.map((seed) => seed.id));
  const simulation = createSimulation(
    seeds,
    edges
      .filter((edge) => present.has(edge.from) && present.has(edge.to))
      .map((edge) => ({
        source: edge.from,
        target: edge.to,
        weight: edge.weight,
      })),
    {
      dimensions: 3,
      groupCenters: Object.fromEntries(
        [...centers].map(([room, point]) => [
          room,
          { x: point[0], y: point[1], z: point[2] } satisfies Vec,
        ]),
      ),
      linkDistance: 1.7,
      linkStrength: 0.38,
      repulsion: 2.6,
      repulsionCutoff: 6,
      groupGravity: 0.05,
      centerGravity: 0.004,
    },
  );
  simulation.settle(500);

  const positions = new Map<string, Point>(
    simulation.nodes.map((node) => [node.id, [node.x, node.y, node.z] as Point]),
  );
  const points = [...positions.values()];
  const minimum = [0, 1, 2].map((axis) =>
    Math.min(...points.map((point) => point[axis])),
  );
  const maximum = [0, 1, 2].map((axis) =>
    Math.max(...points.map((point) => point[axis])),
  );
  const center: Point = points.length
    ? [
        (minimum[0] + maximum[0]) / 2,
        (minimum[1] + maximum[1]) / 2,
        (minimum[2] + maximum[2]) / 2,
      ]
    : [0, 0, 0];
  const radius = Math.max(
    3,
    ...points.map((point) =>
      Math.hypot(
        point[0] - center[0],
        point[1] - center[1],
        point[2] - center[2],
      ),
    ),
  );
  return { positions, centers, center, radius };
}

function Navigation({
  command,
  selected,
  enabled,
  center,
  radius,
}: {
  center: Point;
  radius: number;
  command: Command;
  selected?: Point;
  enabled: boolean;
}) {
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null);
  const { camera, size, gl, invalidate } = useThree();
  const tween = useRef<{ position: Vector3; target: Vector3 } | null>(null);
  const reducedMotion = useRef(false);
  const lastCommand = useRef({ sequence: -1, width: 0, height: 0 });
  useEffect(() => {
    reducedMotion.current = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
  }, []);
  useEffect(() => {
    const controller = controls.current;
    if (!controller) return;
    if (
      lastCommand.current.sequence === command.sequence &&
      lastCommand.current.width === size.width &&
      lastCommand.current.height === size.height
    )
      return;
    lastCommand.current = {
      sequence: command.sequence,
      width: size.width,
      height: size.height,
    };
    const target = controller.target.clone();
    const position = camera.position.clone();
    if (command.type === "fit") {
      target.set(...center);
      const fit = Math.max(1, size.height / size.width);
      position
        .copy(target)
        .add(
          new Vector3(0.12, 0.08, 1)
            .normalize()
            .multiplyScalar(
              (radius / Math.sin((24 * Math.PI) / 180)) * fit * 1.2,
            ),
        );
    } else if (command.type === "focus" && selected) {
      target.set(...selected);
      position.copy(target).add(new Vector3(0, 1, 10));
    } else if (command.type === "in" || command.type === "out") {
      const direction = position.sub(target);
      const distance = Math.max(
        3,
        Math.min(
          100,
          direction.length() * (command.type === "in" ? 0.76 : 1.32),
        ),
      );
      position.copy(target).add(direction.normalize().multiplyScalar(distance));
    }
    tween.current = { position, target };
    invalidate();
  }, [
    camera,
    command,
    selected,
    center,
    radius,
    size.width,
    size.height,
    invalidate,
  ]);
  useEffect(() => {
    if (!enabled) return;
    const canvas = gl.domElement;
    const wheel = (event: WheelEvent) => {
      if (!controls.current) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      const target = controls.current.target.clone();
      const position = (tween.current?.position ?? camera.position).clone();
      const direction = position.sub(target);
      const units =
        event.deltaMode === 1
          ? 16
          : event.deltaMode === 2
            ? canvas.clientHeight
            : 1;
      const delta = Math.max(-100, Math.min(100, event.deltaY * units));
      const distance = Math.max(
        3,
        Math.min(
          100,
          direction.length() *
            Math.exp(delta * (event.ctrlKey ? 0.008 : 0.003)),
        ),
      );
      tween.current = {
        position: target
          .clone()
          .add(direction.normalize().multiplyScalar(distance)),
        target,
      };
      invalidate();
    };
    canvas.addEventListener("wheel", wheel, { passive: false, capture: true });
    return () => canvas.removeEventListener("wheel", wheel, true);
  }, [enabled, gl, camera, invalidate]);
  useFrame((_, delta) => {
    const next = tween.current;
    if (!next || !controls.current) return;
    const alpha = reducedMotion.current
      ? 1
      : 1 - Math.exp(-8 * Math.min(delta, 0.1));
    camera.position.lerp(next.position, alpha);
    controls.current.target.lerp(next.target, alpha);
    controls.current.update();
    if (
      camera.position.distanceTo(next.position) < 0.015 &&
      controls.current.target.distanceTo(next.target) < 0.015
    )
      tween.current = null;
    else invalidate();
  });
  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enabled={enabled}
      enableZoom={enabled}
      enableDamping
      dampingFactor={0.09}
      rotateSpeed={0.45}
      zoomSpeed={0.5}
      panSpeed={0.6}
      minDistance={3}
      maxDistance={100}
      onStart={() => {
        tween.current = null;
      }}
    />
  );
}

function GraphScene({
  nodes,
  layoutNodes,
  layoutEdges,
  edges,
  selectedId,
  onSelect,
  interactive,
  command,
  onHover,
}: Props & { command: Command; onHover: (active: boolean) => void }) {
  const { positions, centers, center, radius } = useMemo(
    () => layout(layoutNodes, layoutEdges),
    [layoutNodes, layoutEdges],
  );
  const visible = new Set(nodes.map((node) => node.id));
  const neighbors = new Set([selectedId]);
  for (const edge of edges) {
    if (edge.from === selectedId) neighbors.add(edge.to);
    if (edge.to === selectedId) neighbors.add(edge.from);
  }
  const [hovered, setHovered] = useState<string | null>(null);
  const highlight = hovered ?? selectedId;
  const label = nodes.find((node) => node.id === highlight);
  const point = highlight ? positions.get(highlight) : undefined;
  return (
    <>
      <color attach="background" args={["#111416"]} />
      <ambientLight intensity={1.4} />
      <directionalLight position={[10, 15, 20]} intensity={2} />
      {edges.map((edge) => {
        const a = positions.get(edge.from),
          b = positions.get(edge.to);
        if (!a || !b || !visible.has(edge.from) || !visible.has(edge.to))
          return null;
        const active = edge.from === selectedId || edge.to === selectedId;
        return (
          <Line
            key={edge.id}
            points={[a, b]}
            color={active ? "#c7dfc7" : "#566b60"}
            transparent
            opacity={active ? 0.85 : selectedId ? 0.13 : 0.38}
            lineWidth={active ? 1.6 : 0.7}
            dashed={edge.type === "derived_from"}
            dashSize={0.2}
            gapSize={0.12}
          />
        );
      })}
      {nodes.map((node) => {
        const selected = node.id === selectedId;
        const strength = node.confidence ?? node.clarity ?? 0.9;
        const muted = selectedId && !neighbors.has(node.id);
        const click = (event: ThreeEvent<MouseEvent>) => {
          event.stopPropagation();
          if (interactive) onSelect(node.id);
        };
        return (
          <group key={node.id} position={positions.get(node.id)}>
            <mesh
              onClick={click}
              onPointerOver={(event) => {
                event.stopPropagation();
                if (interactive) {
                  setHovered(node.id);
                  onHover(true);
                }
              }}
              onPointerOut={() => {
                setHovered(null);
                onHover(false);
              }}
              scale={selected ? 1.45 : 1}
            >
              {node.kind === "procedure" ? (
                <octahedronGeometry args={[0.34]} />
              ) : node.kind === "capture" ? (
                <boxGeometry args={[0.28, 0.28, 0.28]} />
              ) : (
                <sphereGeometry args={[0.22 + strength * 0.08, 16, 12]} />
              )}
              <meshStandardMaterial
                color={COLORS[node.room]}
                emissive={COLORS[node.room]}
                emissiveIntensity={selected ? 0.7 : 0.12}
                roughness={0.6}
                transparent
                opacity={muted ? 0.24 : 0.5 + strength * 0.5}
              />
            </mesh>
            {selected && (
              <mesh rotation={[0, 0, 0.2]}>
                <torusGeometry args={[0.58, 0.016, 6, 48]} />
                <meshBasicMaterial color="#e0f5d8" />
              </mesh>
            )}
          </group>
        );
      })}
      {ROOMS.map(
        (room) =>
          nodes.some((node) => node.room === room) && (
            <Billboard
              key={room}
              position={[
                centers.get(room)![0],
                centers.get(room)![1] + 4.2,
                centers.get(room)![2],
              ]}
            >
              <Text
                font="/fonts/Geist-Regular.ttf"
                fontSize={0.27}
                color={COLORS[room]}
                anchorX="center"
                anchorY="middle"
                letterSpacing={0.15}
              >
                {room.toUpperCase()}
              </Text>
            </Billboard>
          ),
      )}
      {label && point && (
        <Billboard position={[point[0], point[1] + 1.15, point[2]]}>
          <Text
            font="/fonts/Geist-Regular.ttf"
            fontSize={0.27}
            color="#e0edda"
            maxWidth={5}
            textAlign="center"
            anchorX="center"
            anchorY="bottom"
            outlineWidth={0.025}
            outlineColor="#111416"
          >
            {label.label.length > 100
              ? label.label.slice(0, 97) + "…"
              : label.label}
          </Text>
        </Billboard>
      )}
      <Navigation
        command={command}
        center={center}
        radius={radius}
        selected={selectedId ? positions.get(selectedId) : undefined}
        enabled={interactive}
      />
    </>
  );
}

export default function SpatialMemory(props: Props) {
  const [dragging, setDragging] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [command, setCommand] = useState<Command>({ type: "fit", sequence: 0 });
  const go = (type: Command["type"]) =>
    setCommand((previous) => ({ type, sequence: previous.sequence + 1 }));
  const buttonStyle = {
    background: "#243029",
    color: "#dbe6d5",
    border: "1px solid #445346",
    borderRadius: 7,
    padding: "9px 12px",
    fontSize: 12,
    cursor: "pointer",
  };
  return (
    <div style={{ position: "absolute", inset: 0, background: "#111416" }}>
      <Canvas
        onPointerDown={() => setDragging(true)}
        onPointerUp={() => setDragging(false)}
        onPointerCancel={() => setDragging(false)}
        frameloop="demand"
        dpr={[1, 1.5]}
        camera={{ position: [5, 4, 35], fov: 48, near: 0.1, far: 500 }}
        gl={{ antialias: true }}
        style={{
          pointerEvents: props.interactive ? "auto" : "none",
          cursor: dragging ? "grabbing" : hovered ? "pointer" : "crosshair",
          touchAction: props.interactive ? "none" : "pan-y",
        }}
        fallback={
          <div style={{ padding: 30, color: "#d5dfd2" }}>
            3D is unavailable in this browser. The 2D graph contains the same
            memories.
          </div>
        }
        aria-label="3D knowledge graph"
      >
        <GraphScene {...props} command={command} onHover={setHovered} />
      </Canvas>
      {props.interactive ? (
        <div
          style={{
            position: "absolute",
            right: 16,
            top: 16,
            display: "flex",
            gap: 5,
          }}
        >
          <button
            style={buttonStyle}
            onClick={() => go("out")}
            aria-label="Zoom out in 3D"
          >
            −
          </button>
          <button
            style={buttonStyle}
            onClick={() => go("in")}
            aria-label="Zoom in in 3D"
          >
            +
          </button>
          <button style={buttonStyle} onClick={() => go("fit")}>
            Fit all
          </button>
          <button
            style={{ ...buttonStyle, opacity: props.selectedId ? 1 : 0.45 }}
            disabled={!props.selectedId}
            onClick={() => go("focus")}
          >
            Focus memory
          </button>
        </div>
      ) : (
        <button
          onClick={props.onExplore}
          style={{
            ...buttonStyle,
            position: "absolute",
            left: "50%",
            bottom: "20%",
            transform: "translateX(-50%)",
            padding: "13px 22px",
            background: "#d7e8c9",
            color: "#273421",
            borderColor: "#d7e8c9",
            boxShadow: "0 8px 40px #0008",
            fontSize: 13,
          }}
        >
          Explore the brain ↗
        </button>
      )}
    </div>
  );
}
