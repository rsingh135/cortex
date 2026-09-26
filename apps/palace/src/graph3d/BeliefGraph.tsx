"use client";
/**
 * The whole graph from the store: clusters, links, nodes. Nodes that drop out of the selection
 * (forgotten, superseded, or pushed out of the top five) linger briefly so they can flicker out.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { computeGraphLayout, DEFAULT_PER_ROOM, type GraphNode } from "@/lib/graphLayout";
import { useSnapshot } from "@/lib/store";
import { BeliefNode } from "./BeliefNode";
import { ClusterLabel } from "./ClusterLabel";
import { GraphLinks } from "./GraphLinks";

const LINGER_MS = 800;

export function BeliefGraph({ font, perRoom = DEFAULT_PER_ROOM }: { font?: string; perRoom?: number }) {
  const snapshot = useSnapshot();
  const layout = useMemo(() => computeGraphLayout(snapshot, perRoom), [snapshot, perRoom]);
  const previous = useRef<Map<string, GraphNode>>(new Map());
  const [leaving, setLeaving] = useState<Array<{ node: GraphNode; since: number }>>([]);

  useEffect(() => {
    const gone = [...previous.current.values()].filter((n) => !layout.nodes.has(n.id));
    previous.current = layout.nodes;
    if (gone.length === 0) return;
    const since = Date.now();
    setLeaving((l) => [...l, ...gone.map((node) => ({ node, since }))]);
    const timer = setTimeout(() => setLeaving((l) => l.filter((x) => x.since !== since)), LINGER_MS);
    return () => clearTimeout(timer);
  }, [layout]);

  return (
    <group>
      {layout.clusters.map((c) => (
        <ClusterLabel key={c.room} cluster={c} font={font} />
      ))}
      <GraphLinks layout={layout} />
      {[...layout.nodes.values()].map((n) => (
        <BeliefNode key={n.id} node={n} font={font} />
      ))}
      {leaving.map(({ node, since }) => (
        <BeliefNode key={`leaving:${node.id}:${since}`} node={node} font={font} leavingSince={since} />
      ))}
    </group>
  );
}
