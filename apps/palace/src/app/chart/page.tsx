import type { Metadata } from "next";
import { ChartView } from "./ChartView";

export const metadata: Metadata = {
  title: "The proof",
  description: "Bytes stored and weighted answer accuracy over Maya's month for three memory strategies.",
};

export default function ChartPage() {
  return <ChartView />;
}
