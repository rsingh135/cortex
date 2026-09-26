"use client";
/** Loads the palace without server rendering: the Canvas needs `window` and WebGL. */
import dynamic from "next/dynamic";
import { PalaceLoading } from "./PalaceLoading";

const Palace = dynamic(() => import("./Palace").then((m) => m.Palace), { ssr: false, loading: () => <PalaceLoading /> });

export function PalaceClient() {
  return <Palace />;
}
