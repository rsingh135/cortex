import type { Metadata } from "next";
import MemoryExplorer from "../../graph/MemoryExplorer";

export const metadata: Metadata = {
  title: "Memory graph · Cortex",
  description:
    "Explore connected memories, their confidence, and the evidence behind them in 2D or 3D.",
};
export default function GraphPage() {
  return <MemoryExplorer />;
}
