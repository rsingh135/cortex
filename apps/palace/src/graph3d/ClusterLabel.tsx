"use client";
/** Room name floating above its cluster, in the cluster's colour, always facing the camera. */
import { Billboard, Text } from "@react-three/drei";
import type { GraphCluster } from "@/lib/graphLayout";
import { CLUSTER_RADIUS } from "@/lib/graphLayout";

export function ClusterLabel({ cluster, font }: { cluster: GraphCluster; font?: string }) {
  const [x, y, z] = cluster.center;
  return (
    <Billboard position={[x, y + CLUSTER_RADIUS * 0.75 + 0.6, z]}>
      <Text font={font} fontSize={0.62} letterSpacing={0.12} anchorX="center" anchorY="middle" color={cluster.color} fillOpacity={0.9} outlineWidth={0.02} outlineColor="#0e0f12">
        {cluster.room.toUpperCase()}
      </Text>
      <Text font={font} position={[0, -0.5, 0]} fontSize={0.24} anchorX="center" anchorY="middle" color="#9aa4c2">
        {`${cluster.count} ${cluster.count === 1 ? "memory" : "memories"}`}
      </Text>
    </Billboard>
  );
}
