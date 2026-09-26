"use client";
/** Loads the belief graph without server rendering: the Canvas needs `window` and WebGL. */
import dynamic from "next/dynamic";
import { PalaceLoading } from "../_palace/PalaceLoading";

const Graph = dynamic(() => import("./Graph").then((m) => m.Graph), { ssr: false, loading: () => <PalaceLoading /> });

export function GraphClient() {
  return <Graph />;
}
