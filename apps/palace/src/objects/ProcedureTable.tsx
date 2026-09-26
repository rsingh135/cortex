"use client";
/**
 * A procedure as a pale-wood table along the room's back wall. Steps are small cards laid on the
 * top with drei `<Text>`; the front edge carries the procedure's name. When the procedure is
 * cracked, dark crack decals and a red hairline appear on the top; healing fades them out.
 */
import { Text } from "@react-three/drei";
import type { ThreeEvent } from "@react-three/fiber";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { truncate } from "@/lib/format";
import { fnv1a } from "@/lib/hash";
import { useIsHovered, useIsSelected, usePalaceActions, usePalaceStore, useProcedure } from "@/lib/store";
import type { PalaceProcedureStep, Placement } from "@/lib/types";
import {
  CRACK_INK,
  CRACK_RED,
  DARK_WOOD,
  HOVER_EMISSIVE,
  INK,
  MAX_STEP_CARDS,
  PALE_WOOD,
  PLASTER,
  SELECT_EMISSIVE,
  STEP_CARD_HEIGHT,
  STEP_CARD_WIDTH,
  TABLE_DEPTH,
  TABLE_HEIGHT,
  TABLE_TOP_THICKNESS,
  TABLE_WIDTH,
} from "./palette";

export interface ProcedureTableProps {
  id: string;
  placement: Placement;
  /** Optional font URL for drei `<Text>`. */
  font?: string;
}

const LEG = 0.07;
const CARD_GAP_X = 0.42;
const CARD_GAP_Z = 0.32;
const CARD_LIFT = 0.004;
const TEXT_LIFT = 0.002;
const CRACK_COUNT = 3;
const CRACK_APPEAR_LAMBDA = 14;
const HEAL_LAMBDA = 3;
const CRACK_OPACITY = 0.85;

interface TableGeometries {
  top: THREE.BoxGeometry;
  leg: THREE.BoxGeometry;
  card: THREE.PlaneGeometry;
  crack: THREE.PlaneGeometry;
  hairline: THREE.BoxGeometry;
}

let shared: TableGeometries | null = null;
function tableGeometries(): TableGeometries {
  if (!shared) {
    const card = new THREE.PlaneGeometry(STEP_CARD_WIDTH, STEP_CARD_HEIGHT);
    card.rotateX(-Math.PI / 2);
    const crack = new THREE.PlaneGeometry(0.55, 0.012);
    crack.rotateX(-Math.PI / 2);
    shared = {
      top: new THREE.BoxGeometry(TABLE_WIDTH, TABLE_TOP_THICKNESS, TABLE_DEPTH),
      leg: new THREE.BoxGeometry(LEG, TABLE_HEIGHT - TABLE_TOP_THICKNESS, LEG),
      card,
      crack,
      hairline: new THREE.BoxGeometry(TABLE_WIDTH * 0.92, 0.004, 0.006),
    };
  }
  return shared;
}

interface CardSlot {
  step: PalaceProcedureStep;
  x: number;
  z: number;
}

function cardSlots(steps: readonly PalaceProcedureStep[]): CardSlot[] {
  const shown = steps.slice(0, MAX_STEP_CARDS);
  const n = shown.length;
  if (n === 0) return [];
  const cols = Math.min(4, n);
  const rows = Math.ceil(n / cols);
  return shown.map((step, i) => {
    const c = i % cols;
    const r = Math.floor(i / cols);
    return { step, x: (c - (cols - 1) / 2) * CARD_GAP_X, z: (r - (rows - 1) / 2) * CARD_GAP_Z - 0.08 };
  });
}

interface CrackDecal {
  x: number;
  z: number;
  rotationY: number;
  scale: number;
}

/** Deterministic crack pattern from the procedure id, so it looks the same on every render. */
function crackDecals(id: string): CrackDecal[] {
  const out: CrackDecal[] = [];
  let h = fnv1a(id);
  const next = () => {
    h = fnv1a(`${h}`);
    return h / 0xffffffff;
  };
  for (let i = 0; i < CRACK_COUNT; i++) {
    out.push({ x: (next() - 0.5) * TABLE_WIDTH * 0.6, z: (next() - 0.5) * TABLE_DEPTH * 0.6, rotationY: next() * Math.PI, scale: 0.6 + next() * 0.8 });
  }
  return out;
}

export function ProcedureTable({ id, placement, font }: ProcedureTableProps) {
  const procedure = useProcedure(id);
  const selected = useIsSelected(id);
  const hovered = useIsHovered(id);
  const { select, hover } = usePalaceActions();
  const geometries = tableGeometries();
  const cracked = procedure?.status === "cracked";
  const crackGroup = useRef<THREE.Group>(null);
  const crackAmount = useRef(cracked ? 1 : 0);

  const slots = useMemo(() => cardSlots(procedure?.steps ?? []), [procedure?.steps]);
  const decals = useMemo(() => crackDecals(id), [id]);
  const crackedBy = useMemo(() => new Set(procedure?.crackedBy ?? []), [procedure?.crackedBy]);

  useFrame((_, delta) => {
    const group = crackGroup.current;
    if (!group) return;
    const target = cracked ? 1 : 0;
    const current = crackAmount.current;
    if (current === target) return;
    let next = THREE.MathUtils.damp(current, target, cracked ? CRACK_APPEAR_LAMBDA : HEAL_LAMBDA, delta);
    if (Math.abs(next - target) < 0.005) next = target;
    crackAmount.current = next;
    group.visible = next > 0;
    group.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return;
      const material: unknown = obj.material;
      if (material instanceof THREE.Material) material.opacity = next * (material.userData.maxOpacity as number);
    });
  });

  if (!procedure) return null;

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    select(id);
  };
  const onPointerOver = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    hover(id);
  };
  const onPointerOut = () => {
    if (usePalaceStore.getState().hoveredId === id) hover(null);
  };

  const emissive = hovered ? HOVER_EMISSIVE : selected ? SELECT_EMISSIVE : "#000000";
  const emissiveIntensity = hovered ? 0.25 : selected ? 0.4 : 0;
  const topY = TABLE_HEIGHT;
  const legY = (TABLE_HEIGHT - TABLE_TOP_THICKNESS) / 2;
  const legX = TABLE_WIDTH / 2 - LEG;
  const legZ = TABLE_DEPTH / 2 - LEG;

  return (
    <group position={placement.position} rotation-y={placement.rotationY} onClick={onClick} onPointerOver={onPointerOver} onPointerOut={onPointerOut}>
      <mesh geometry={geometries.top} position-y={topY - TABLE_TOP_THICKNESS / 2} castShadow receiveShadow>
        <meshStandardMaterial color={PALE_WOOD} roughness={0.65} emissive={emissive} emissiveIntensity={emissiveIntensity} />
      </mesh>
      {[
        [-legX, legZ],
        [legX, legZ],
        [-legX, -legZ],
        [legX, -legZ],
      ].map(([x, z]) => (
        <mesh key={`${x},${z}`} geometry={geometries.leg} position={[x, legY, z]} castShadow>
          <meshStandardMaterial color={DARK_WOOD} roughness={0.7} />
        </mesh>
      ))}

      <Text position={[0, topY + TEXT_LIFT, TABLE_DEPTH / 2 - 0.08]} rotation-x={-Math.PI / 2} fontSize={0.055} maxWidth={TABLE_WIDTH * 0.9} color={INK} anchorX="center" anchorY="middle" font={font}>
        {truncate(procedure.name, 40)}
      </Text>

      {slots.map(({ step, x, z }) => {
        const broken = step.uses.some((u) => crackedBy.has(u));
        return (
          <group key={step.n} position={[x, topY + CARD_LIFT, z]}>
            <mesh geometry={geometries.card}>
              <meshStandardMaterial color={broken ? "#f3d4cf" : PLASTER} roughness={0.9} />
            </mesh>
            <Text position={[0, TEXT_LIFT, 0]} rotation-x={-Math.PI / 2} fontSize={0.028} maxWidth={STEP_CARD_WIDTH * 0.88} lineHeight={1.15} color={broken ? CRACK_RED : INK} anchorX="center" anchorY="middle" textAlign="left" font={font}>
              {`${step.n}. ${truncate(step.do, 60)}`}
            </Text>
          </group>
        );
      })}

      <group ref={crackGroup} visible={cracked}>
        {decals.map((d, i) => (
          <mesh key={i} geometry={geometries.crack} position={[d.x, topY + CARD_LIFT * 2, d.z]} rotation-y={d.rotationY} scale={[d.scale, 1, 1]}>
            <meshBasicMaterial color={CRACK_INK} transparent opacity={cracked ? CRACK_OPACITY : 0} depthWrite={false} userData={{ maxOpacity: CRACK_OPACITY }} />
          </mesh>
        ))}
        <mesh geometry={geometries.hairline} position={[0, topY + 0.001, -0.1]} rotation-y={0.08}>
          <meshStandardMaterial color={CRACK_RED} emissive={CRACK_RED} emissiveIntensity={0.6} transparent opacity={cracked ? 1 : 0} userData={{ maxOpacity: 1 }} />
        </mesh>
      </group>
    </group>
  );
}
