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

export type TargetType = "order" | "refund" | "product";

export interface CreateInstanceInput {
  workflowType: "order_flow" | "refund_approval" | "product_approval";
  targetType: TargetType;
  targetId: string;
  context?: Record<string, unknown>;
}

export interface TransitionInput {
  instanceId: string;
  trigger: string;
  operator?: string;
  comment?: string;
}
