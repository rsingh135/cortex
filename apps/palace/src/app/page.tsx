import type { Metadata } from "next";
import MemoryExplorer from "../graph/MemoryExplorer";

export const metadata: Metadata = {
  title: "Cortex · Your brain",
  description: "Explore your memories and the connections between them.",
};
export default function Home() {
  return <MemoryExplorer />;
}
