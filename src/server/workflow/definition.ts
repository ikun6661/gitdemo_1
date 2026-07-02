import type { WorkflowDefinition, WorkflowEdge, WorkflowNode } from "./types";

function parseJsonArray<T>(raw: string, fieldName: string): T[] {
  const parsed: unknown = JSON.parse(raw);

  if (!Array.isArray(parsed)) {
    throw new Error(`${fieldName} 必须是数组`);
  }

  return parsed as T[];
}

export function parseWorkflowDefinition(
  nodesRaw: string,
  edgesRaw: string,
): WorkflowDefinition {
  return {
    nodes: parseJsonArray<WorkflowNode>(nodesRaw, "nodes"),
    edges: parseJsonArray<WorkflowEdge>(edgesRaw, "edges"),
  };
}

export function findNextEdge(
  currentNode: string,
  trigger: string,
  edges: WorkflowEdge[],
): WorkflowEdge | null {
  return (
    edges.find((edge) => edge.from === currentNode && edge.trigger === trigger) ??
    null
  );
}

export function isEndNode(nodeKey: string, edges: WorkflowEdge[]): boolean {
  return !edges.some((edge) => edge.from === nodeKey);
}
