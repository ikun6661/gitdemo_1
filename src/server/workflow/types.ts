export interface WorkflowNode {
  key: string;
  label: string;
}

export interface WorkflowEdge {
  from: string;
  to: string;
  trigger: string;
  label: string;
}

export interface WorkflowDefinition {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

export type WorkflowType =
  | "order_flow"
  | "refund_approval"
  | "product_approval";

export type TargetType = "order" | "refund" | "product";

export type WorkflowStatus = "running" | "completed" | "cancelled";

export interface WorkflowContext {
  orderNo?: string;
  amount?: number;
  operator?: string;
  [key: string]: unknown;
}

export interface CreateInstanceInput {
  workflowType: WorkflowType;
  targetType: TargetType;
  targetId: string;
  context?: WorkflowContext;
}

export interface TransitionInput {
  instanceId: string;
  trigger: string;
  operator?: string;
  comment?: string;
}
