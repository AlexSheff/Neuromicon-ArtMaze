import graphData from '../../../registry/world.graph.json';
import { WorldGraphEdge, WorldGraphManifest, WorldGraphNode } from '../../types/artmaze';

const runtimeGraph: WorldGraphManifest = JSON.parse(
  JSON.stringify(graphData)
) as WorldGraphManifest;

export function getWorldGraph(): WorldGraphManifest {
  return runtimeGraph;
}

export function getOutgoingEdges(roomId: string): WorldGraphEdge[] {
  return runtimeGraph.edges.filter((e) => e.from === roomId);
}

export function getIncomingEdges(roomId: string): WorldGraphEdge[] {
  return runtimeGraph.edges.filter((e) => e.to === roomId);
}

export function upsertGraphNode(node: WorldGraphNode): void {
  const idx = runtimeGraph.nodes.findIndex((n) => n.id === node.id);
  if (idx >= 0) {
    runtimeGraph.nodes[idx] = node;
  } else {
    runtimeGraph.nodes.push(node);
  }
}
