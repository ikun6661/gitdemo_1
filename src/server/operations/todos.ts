import { prisma } from "@/lib/prisma";
import { transition } from "@/server/workflow/engine";

export type OpsTodoType = "order" | "refund" | "product";
export type OpsTodoActionVariant = "default" | "outline" | "destructive";
export type OpsTodoStatusTone =
  | "yellow"
  | "blue"
  | "green"
  | "red"
  | "gray"
  | "orange";

export interface OpsTodoAction {
  key: string;
  label: string;
  variant: OpsTodoActionVariant;
  requiresComment?: boolean;
}

export interface OpsTodo {
  id: string;
  type: OpsTodoType;
  title: string;
  subtitle: string;
  status: string;
  statusLabel: string;
  statusTone: OpsTodoStatusTone;
  targetId: string;
  workflowInstanceId?: string;
  amount?: number;
  customerName?: string;
  createdAt: string;
  actions: OpsTodoAction[];
}

export interface OpsTodoSummary {
  total: number;
  orders: number;
  refunds: number;
  products: number;
}

export interface OpsTodoListResponse {
  summary: OpsTodoSummary;
  todos: OpsTodo[];
}

export interface OpsTodoFilters {
  type?: OpsTodoType;
  status?: string;
  search?: string;
}

export interface PerformOpsTodoActionInput {
  todoId: string;
  action: string;
  operator: string;
  comment?: string;
}

interface WorkflowNodeView {
  key: string;
  label: string;
}

interface WorkflowEdgeView {
  from: string;
  to: string;
  trigger: string;
  label: string;
}

interface WorkflowTodoInstance {
  id: string;
  targetType: string;
  targetId: string;
  currentNode: string;
  createdAt: Date;
  context: string | Record<string, unknown>;
  workflow: {
    nodes: string | WorkflowNodeView[];
    edges: string | WorkflowEdgeView[];
  };
}

interface NormalizedWorkflowTodoInstance {
  id: string;
  targetType: string;
  targetId: string;
  currentNode: string;
  createdAt: Date;
  context: Record<string, unknown>;
  workflow: {
    nodes: WorkflowNodeView[];
    edges: WorkflowEdgeView[];
  };
}

interface ProductTodoSource {
  id: string;
  name: string;
  status: string;
  price: number;
  stock: number;
  createdAt: Date;
}

const refundActionsByNode: Record<string, OpsTodoAction[]> = {
  pending_review: [
    { key: "submit", label: "提交审核", variant: "default" },
    {
      key: "reject",
      label: "驳回",
      variant: "destructive",
      requiresComment: true,
    },
  ],
  cs_review: [
    { key: "cs_approve", label: "客服通过", variant: "default" },
    {
      key: "cs_reject",
      label: "客服驳回",
      variant: "destructive",
      requiresComment: true,
    },
  ],
  manager_approval: [
    { key: "manager_approve", label: "经理通过", variant: "default" },
    {
      key: "manager_reject",
      label: "经理驳回",
      variant: "destructive",
      requiresComment: true,
    },
  ],
};

const statusLabels: Record<string, string> = {
  paid: "已支付",
  pending_review: "待初审",
  cs_review: "客服审核",
  manager_approval: "经理审批",
  pending: "待审核",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseRecord(value: string | Record<string, unknown>): Record<string, unknown> {
  if (typeof value !== "string") return value;

  try {
    const parsed: unknown = JSON.parse(value);
    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function parseArray<T>(value: string | T[]): T[] {
  if (Array.isArray(value)) return value;

  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function normalizeInstance(
  instance: WorkflowTodoInstance,
): NormalizedWorkflowTodoInstance {
  return {
    ...instance,
    context: parseRecord(instance.context),
    workflow: {
      nodes: parseArray<WorkflowNodeView>(instance.workflow.nodes),
      edges: parseArray<WorkflowEdgeView>(instance.workflow.edges),
    },
  };
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

function getStatusLabel(instance: NormalizedWorkflowTodoInstance): string {
  return (
    instance.workflow.nodes.find((node) => node.key === instance.currentNode)
      ?.label ??
    statusLabels[instance.currentNode] ??
    instance.currentNode
  );
}

function getCustomerName(context: Record<string, unknown>): string | undefined {
  return (
    asString(context.customerName) ??
    asString(context.userName) ??
    asString(context.operator)
  );
}

function matchesFilters(todo: OpsTodo, filters: OpsTodoFilters): boolean {
  if (filters.type && todo.type !== filters.type) return false;
  if (filters.status && todo.status !== filters.status) return false;

  const keyword = filters.search?.trim().toLowerCase();
  if (!keyword) return true;

  const searchText = [
    todo.id,
    todo.title,
    todo.subtitle,
    todo.status,
    todo.statusLabel,
    todo.targetId,
    todo.customerName ?? "",
    String(todo.amount ?? ""),
  ]
    .join(" ")
    .toLowerCase();

  return searchText.includes(keyword);
}

function summarize(todos: OpsTodo[]): OpsTodoSummary {
  return {
    total: todos.length,
    orders: todos.filter((todo) => todo.type === "order").length,
    refunds: todos.filter((todo) => todo.type === "refund").length,
    products: todos.filter((todo) => todo.type === "product").length,
  };
}

function parseTodoId(todoId: string): { type: OpsTodoType; id: string } {
  const parts = todoId.split(":");
  if (parts.length !== 2 || parts[1].length === 0) {
    throw new Error("待办 ID 无效");
  }

  const [type, id] = parts;
  if (type !== "order" && type !== "refund" && type !== "product") {
    throw new Error("待办 ID 无效");
  }

  return { type, id };
}

async function getRunningWorkflowTarget(
  instanceId: string,
  targetType: "order" | "refund",
): Promise<string> {
  const instance = await prisma.workflowInstance.findUnique({
    where: { id: instanceId },
    select: { targetId: true, targetType: true, status: true },
  });

  if (!instance || instance.targetType !== targetType) {
    throw new Error("待办不存在");
  }
  if (instance.status !== "running") {
    throw new Error("待办已处理");
  }

  return instance.targetId;
}

export function buildOrderTodo(
  instanceInput: WorkflowTodoInstance,
): OpsTodo | null {
  const instance = normalizeInstance(instanceInput);
  if (instance.currentNode !== "paid") return null;

  const orderNo = asString(instance.context.orderNo) ?? instance.targetId;
  const amount = asNumber(instance.context.amount);
  const customerName = getCustomerName(instance.context);

  return {
    id: `order:${instance.id}`,
    type: "order",
    title: `订单 ${orderNo}`,
    subtitle: "客户已支付，等待确认发货",
    status: instance.currentNode,
    statusLabel: getStatusLabel(instance),
    statusTone: "blue",
    targetId: instance.targetId,
    workflowInstanceId: instance.id,
    amount,
    customerName,
    createdAt: instance.createdAt.toISOString(),
    actions: [{ key: "ship", label: "确认发货", variant: "default" }],
  };
}

export function buildRefundTodo(
  instanceInput: WorkflowTodoInstance,
): OpsTodo | null {
  const instance = normalizeInstance(instanceInput);
  const actions = refundActionsByNode[instance.currentNode];
  if (!actions) return null;

  const orderNo = asString(instance.context.orderNo) ?? instance.targetId;
  const amount = asNumber(instance.context.amount);
  const reason = asString(instance.context.reason);
  const customerName = getCustomerName(instance.context);

  return {
    id: `refund:${instance.id}`,
    type: "refund",
    title: `退款 ${orderNo}`,
    subtitle: reason ? `退款原因：${reason}` : "等待退款审核",
    status: instance.currentNode,
    statusLabel: getStatusLabel(instance),
    statusTone: instance.currentNode === "manager_approval" ? "orange" : "yellow",
    targetId: instance.targetId,
    workflowInstanceId: instance.id,
    amount,
    customerName,
    createdAt: instance.createdAt.toISOString(),
    actions,
  };
}

export function buildProductTodo(product: ProductTodoSource): OpsTodo {
  return {
    id: `product:${product.id}`,
    type: "product",
    title: `商品 ${product.name}`,
    subtitle: `库存 ${product.stock} 件，等待商品审核`,
    status: product.status,
    statusLabel: statusLabels[product.status] ?? product.status,
    statusTone: "yellow",
    targetId: product.id,
    amount: product.price,
    createdAt: product.createdAt.toISOString(),
    actions: [
      { key: "approve", label: "通过上架", variant: "default" },
      {
        key: "reject",
        label: "驳回",
        variant: "destructive",
        requiresComment: true,
      },
    ],
  };
}

export async function listOpsTodos(
  filters: OpsTodoFilters,
): Promise<OpsTodoListResponse> {
  const [instances, products] = await Promise.all([
    prisma.workflowInstance.findMany({
      where: {
        status: "running",
        targetType: { in: ["order", "refund", "product"] },
      },
      include: {
        workflow: true,
        logs: { orderBy: { createdAt: "asc" } },
      },
    }),
    prisma.product.findMany({
      where: { status: "pending" },
    }),
  ]);

  const workflowTodos = instances
    .map((instance) => {
      if (instance.targetType === "order") {
        return buildOrderTodo(instance);
      }
      if (instance.targetType === "refund") {
        return buildRefundTodo(instance);
      }
      return null;
    })
    .filter((todo): todo is OpsTodo => todo !== null);

  const productTodos = products.map(buildProductTodo);

  const todos = [...workflowTodos, ...productTodos]
    .filter((todo) => matchesFilters(todo, filters))
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));

  return {
    summary: summarize(todos),
    todos,
  };
}

export async function performOpsTodoAction(
  input: PerformOpsTodoActionInput,
): Promise<{ success: true }> {
  const { type, id } = parseTodoId(input.todoId);
  const comment = input.comment ?? "";

  if (type === "order") {
    if (input.action !== "ship") throw new Error("订单动作无效");

    const orderId = await getRunningWorkflowTarget(id, "order");
    await prisma.$transaction(async (tx) => {
      await transition(
        {
          instanceId: id,
          trigger: "ship",
          operator: input.operator,
          comment,
        },
        tx,
      );
      await tx.order.update({
        where: { id: orderId },
        data: { status: "shipped" },
      });
    });

    return { success: true };
  }

  if (type === "refund") {
    const allowedActions = [
      "submit",
      "reject",
      "cs_approve",
      "cs_reject",
      "manager_approve",
      "manager_reject",
    ];
    if (!allowedActions.includes(input.action)) {
      throw new Error("退款动作无效");
    }

    const refundId = await getRunningWorkflowTarget(id, "refund");
    const shouldReject =
      input.action === "reject" ||
      input.action === "cs_reject" ||
      input.action === "manager_reject";

    await prisma.$transaction(async (tx) => {
      const refund = await tx.refund.findUnique({
        where: { id: refundId },
        select: { orderId: true },
      });

      if (!refund) {
        throw new Error("退款单不存在");
      }

      await transition(
        {
          instanceId: id,
          trigger: input.action,
          operator: input.operator,
          comment,
        },
        tx,
      );

      if (shouldReject) {
        await tx.refund.update({
          where: { id: refundId },
          data: { status: "rejected" },
        });
      }

      if (input.action === "manager_approve") {
        await tx.refund.update({
          where: { id: refundId },
          data: { status: "approved" },
        });
        await tx.order.update({
          where: { id: refund.orderId },
          data: { status: "refunded" },
        });
      }
    });

    return { success: true };
  }

  if (input.action !== "approve" && input.action !== "reject") {
    throw new Error("商品动作无效");
  }

  const product = await prisma.product.findUnique({
    where: { id },
    select: { id: true, status: true },
  });

  if (!product || product.status !== "pending") {
    throw new Error("商品待办不存在");
  }

  await prisma.product.update({
    where: { id },
    data: { status: input.action === "approve" ? "published" : "rejected" },
  });

  return { success: true };
}
