import type { Metadata } from "next";
import { MapView } from "./MapView";

export const metadata: Metadata = {
  title: "Agent map",
  description: "The palace floor plan and the JSON the agent reads before recalling anything.",
};

export default function MapPage() {
  return <MapView />;
}
