# Commerce Ops Workbench Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a commercial-style operations workbench that aggregates order, refund, and product approval todos and lets staff process them from `/dashboard`.

**Architecture:** Add a server-side operations layer that converts Prisma records and workflow instances into a single `OpsTodo` shape. API routes handle auth, input validation, and service delegation. The dashboard becomes a React Query client that renders stats, filters, search, todo cards, and action buttons.

**Tech Stack:** Next.js App Router, TypeScript, Prisma, NextAuth guards, React Query, shadcn-style UI components, Vitest.

---

## File Structure

- Create `src/server/operations/todos.ts`: service types, todo builders, todo list query, and action execution.
- Create `src/server/operations/todos.test.ts`: unit tests for builders and action behavior with mocked Prisma/workflow calls.
- Create `src/app/api/ops/todos/route.ts`: `GET /api/ops/todos` with staff auth and filters.
- Create `src/app/api/ops/todos/route.test.ts`: route auth and delegation tests.
- Create `src/app/api/ops/todos/[id]/action/route.ts`: `POST /api/ops/todos/[id]/action` with staff auth and JSON body validation.
- Create `src/app/api/ops/todos/[id]/action/route.test.ts`: action route auth, success, and invalid-action tests.
- Modify `src/app/dashboard/page.tsx`: replace workflow-instance list with operations workbench UI.
- No database migration is planned for this stage.

---

### Task 1: Operations Todo Service

**Files:**
- Create: `src/server/operations/todos.ts`
- Create: `src/server/operations/todos.test.ts`

- [ ] **Step 1: Write failing service tests**

Create `src/server/operations/todos.test.ts` with these tests:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildOrderTodo,
  buildProductTodo,
  buildRefundTodo,
  listOpsTodos,
  performOpsTodoAction,
} from "./todos";

const mocks = vi.hoisted(() => ({
  workflowFindMany: vi.fn(),
  workflowFindUnique: vi.fn(),
  orderFindUnique: vi.fn(),
  orderUpdate: vi.fn(),
  refundFindUnique: vi.fn(),
  refundUpdate: vi.fn(),
  productFindMany: vi.fn(),
  productFindUnique: vi.fn(),
  productUpdate: vi.fn(),
  transaction: vi.fn(),
  transition: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: mocks.transaction,
    workflowInstance: {
      findMany: mocks.workflowFindMany,
      findUnique: mocks.workflowFindUnique,
    },
    order: { findUnique: mocks.orderFindUnique, update: mocks.orderUpdate },
    refund: { findUnique: mocks.refundFindUnique, update: mocks.refundUpdate },
    product: {
      findMany: mocks.productFindMany,
      findUnique: mocks.productFindUnique,
      update: mocks.productUpdate,
    },
  },
}));

vi.mock("@/server/workflow/engine", () => ({
  transition: mocks.transition,
}));

const orderInstance = {
  id: "workflow-order-1",
  targetType: "order",
  targetId: "order-1",
  currentNode: "paid",
  createdAt: new Date("2026-07-03T08:00:00.000Z"),
  context: { orderNo: "ORD-20260703-ABC123", amount: 259900 },
  workflow: {
    nodes: [{ key: "paid", label: "已支付" }],
    edges: [{ from: "paid", to: "shipped", trigger: "ship", label: "发货" }],
  },
  logs: [],
};

const refundInstance = {
  id: "workflow-refund-1",
  targetType: "refund",
  targetId: "refund-1",
  currentNode: "manager_approval",
  createdAt: new Date("2026-07-03T09:00:00.000Z"),
  context: {
    orderNo: "ORD-20260703-REFUND",
    reason: "7 天无理由",
    amount: 109900,
  },
  workflow: {
    nodes: [{ key: "manager_approval", label: "经理审批" }],
    edges: [
      {
        from: "manager_approval",
        to: "approved",
        trigger: "manager_approve",
        label: "经理通过",
      },
      {
        from: "manager_approval",
        to: "rejected",
        trigger: "manager_reject",
        label: "经理驳回",
      },
    ],
  },
  logs: [],
};

describe("operations todos", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.workflowFindMany.mockResolvedValue([]);
    mocks.workflowFindUnique.mockResolvedValue(null);
    mocks.productFindMany.mockResolvedValue([]);
    mocks.transaction.mockImplementation((callback) =>
      callback({
        order: { update: mocks.orderUpdate },
        refund: { update: mocks.refundUpdate },
        product: { update: mocks.productUpdate },
      })
    );
  });

  it("builds a ship action for paid order workflow instances", () => {
    const todo = buildOrderTodo(orderInstance);

    expect(todo).toMatchObject({
      id: "order:workflow-order-1",
      type: "order",
      title: "订单 ORD-20260703-ABC123",
      status: "paid",
      targetId: "order-1",
      workflowInstanceId: "workflow-order-1",
      amount: 259900,
    });
    expect(todo?.actions).toEqual([
      { key: "ship", label: "确认发货", variant: "default" },
    ]);
  });

  it("does not build an operations todo for pending_payment orders", () => {
    expect(buildOrderTodo({ ...orderInstance, currentNode: "pending_payment" })).toBeNull();
  });

  it("builds approval actions for manager refund review", () => {
    const todo = buildRefundTodo(refundInstance);

    expect(todo).toMatchObject({
      id: "refund:workflow-refund-1",
      type: "refund",
      title: "退款 ORD-20260703-REFUND",
      status: "manager_approval",
      targetId: "refund-1",
    });
    expect(todo?.actions).toEqual([
      { key: "manager_approve", label: "经理通过", variant: "default" },
      {
        key: "manager_reject",
        label: "经理驳回",
        variant: "destructive",
        requiresComment: true,
      },
    ]);
  });

  it("builds approve and reject actions for pending products", () => {
    const todo = buildProductTodo({
      id: "product-1",
      name: "AirPods Max",
      status: "pending",
      price: 439900,
      stock: 30,
      createdAt: new Date("2026-07-03T10:00:00.000Z"),
      updatedAt: new Date("2026-07-03T10:00:00.000Z"),
    });

    expect(todo).toMatchObject({
      id: "product:product-1",
      type: "product",
      title: "商品 AirPods Max",
      status: "pending",
      targetId: "product-1",
    });
    expect(todo.actions).toEqual([
      { key: "approve", label: "上架", variant: "default" },
      {
        key: "reject",
        label: "驳回",
        variant: "destructive",
        requiresComment: true,
      },
    ]);
  });

  it("aggregates order, refund, and product todos with summary counts", async () => {
    mocks.workflowFindMany.mockResolvedValue([orderInstance, refundInstance]);
    mocks.productFindMany.mockResolvedValue([
      {
        id: "product-1",
        name: "AirPods Max",
        status: "pending",
        price: 439900,
        stock: 30,
        createdAt: new Date("2026-07-03T10:00:00.000Z"),
        updatedAt: new Date("2026-07-03T10:00:00.000Z"),
      },
    ]);

    const result = await listOpsTodos({});

    expect(result.summary).toEqual({
      total: 3,
      orders: 1,
      refunds: 1,
      products: 1,
    });
    expect(result.todos.map((todo) => todo.type)).toEqual([
      "product",
      "refund",
      "order",
    ]);
  });

  it("ships an order by transitioning workflow and updating order status", async () => {
    mocks.workflowFindUnique.mockResolvedValue({
      id: "workflow-order-1",
      targetId: "order-1",
      targetType: "order",
      currentNode: "paid",
      status: "running",
    });
    mocks.transition.mockResolvedValue({
      instance: { id: "workflow-order-1", currentNode: "shipped" },
      isEnd: false,
    });

    await performOpsTodoAction({
      todoId: "order:workflow-order-1",
      action: "ship",
      operator: "运营小王",
    });

    expect(mocks.transition).toHaveBeenCalledWith({
      instanceId: "workflow-order-1",
      trigger: "ship",
      operator: "运营小王",
      comment: "",
    });
    expect(mocks.orderUpdate).toHaveBeenCalledWith({
      where: { id: "order-1" },
      data: { status: "shipped" },
    });
  });

  it("approves a refund and marks the order as refunded", async () => {
    mocks.workflowFindUnique.mockResolvedValue({
      id: "workflow-refund-1",
      targetId: "refund-1",
      targetType: "refund",
      currentNode: "manager_approval",
      status: "running",
    });
    mocks.refundFindUnique.mockResolvedValue({
      id: "refund-1",
      orderId: "order-1",
      status: "pending",
    });
    mocks.transition.mockResolvedValue({
      instance: { id: "workflow-refund-1", currentNode: "approved" },
      isEnd: true,
    });

    await performOpsTodoAction({
      todoId: "refund:workflow-refund-1",
      action: "manager_approve",
      operator: "运营小王",
    });

    expect(mocks.refundUpdate).toHaveBeenCalledWith({
      where: { id: "refund-1" },
      data: { status: "approved" },
    });
    expect(mocks.orderUpdate).toHaveBeenCalledWith({
      where: { id: "order-1" },
      data: { status: "refunded" },
    });
  });

  it("rejects a product without workflow instance by updating product status", async () => {
    mocks.productFindUnique.mockResolvedValue({
      id: "product-1",
      status: "pending",
    });

    await performOpsTodoAction({
      todoId: "product:product-1",
      action: "reject",
      operator: "运营小王",
      comment: "图片不清晰",
    });

    expect(mocks.transition).not.toHaveBeenCalled();
    expect(mocks.productUpdate).toHaveBeenCalledWith({
      where: { id: "product-1" },
      data: { status: "rejected" },
    });
  });
});
```

- [ ] **Step 2: Run the service test to verify it fails**

Run:

```bash
npx vitest run src/server/operations/todos.test.ts
```

Expected: FAIL because `src/server/operations/todos.ts` does not exist.

- [ ] **Step 3: Implement `src/server/operations/todos.ts`**

Create `src/server/operations/todos.ts` with these exports and behavior:

```ts
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

type WorkflowTodoInstance = {
  id: string;
  targetType: string;
  targetId: string;
  currentNode: string;
  createdAt: Date;
  context: Record<string, unknown>;
  workflow: {
    nodes: { key: string; label: string }[];
    edges: { from: string; to: string; trigger: string; label: string }[];
  };
  logs?: unknown[];
};

type PendingProduct = {
  id: string;
  name: string;
  status: string;
  price: number;
  stock: number;
  createdAt: Date;
  updatedAt: Date;
};

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

function nodeLabel(instance: WorkflowTodoInstance): string {
  return (
    instance.workflow.nodes.find((node) => node.key === instance.currentNode)
      ?.label ?? instance.currentNode
  );
}

function createdAtIso(value: Date): string {
  return value.toISOString();
}

export function buildOrderTodo(
  instance: WorkflowTodoInstance
): OpsTodo | null {
  if (instance.currentNode !== "paid") return null;

  const orderNo = asString(instance.context.orderNo) ?? instance.targetId;
  const amount = asNumber(instance.context.amount);

  return {
    id: `order:${instance.id}`,
    type: "order",
    title: `订单 ${orderNo}`,
    subtitle: "顾客已支付，等待运营确认发货",
    status: instance.currentNode,
    statusLabel: nodeLabel(instance),
    statusTone: "blue",
    targetId: instance.targetId,
    workflowInstanceId: instance.id,
    amount,
    createdAt: createdAtIso(instance.createdAt),
    actions: [{ key: "ship", label: "确认发货", variant: "default" }],
  };
}

export function buildRefundTodo(
  instance: WorkflowTodoInstance
): OpsTodo | null {
  const actionMap: Record<string, OpsTodoAction[]> = {
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
  const actions = actionMap[instance.currentNode];
  if (!actions) return null;

  const orderNo = asString(instance.context.orderNo) ?? instance.targetId;
  const amount = asNumber(instance.context.amount);
  const reason = asString(instance.context.reason);

  return {
    id: `refund:${instance.id}`,
    type: "refund",
    title: `退款 ${orderNo}`,
    subtitle: reason ? `原因：${reason}` : "等待退款审核",
    status: instance.currentNode,
    statusLabel: nodeLabel(instance),
    statusTone: instance.currentNode === "manager_approval" ? "orange" : "yellow",
    targetId: instance.targetId,
    workflowInstanceId: instance.id,
    amount,
    createdAt: createdAtIso(instance.createdAt),
    actions,
  };
}

export function buildProductTodo(product: PendingProduct): OpsTodo {
  return {
    id: `product:${product.id}`,
    type: "product",
    title: `商品 ${product.name}`,
    subtitle: `库存 ${product.stock} 件，等待上架审核`,
    status: product.status,
    statusLabel: "待审核",
    statusTone: "yellow",
    targetId: product.id,
    amount: product.price,
    createdAt: createdAtIso(product.createdAt),
    actions: [
      { key: "approve", label: "上架", variant: "default" },
      {
        key: "reject",
        label: "驳回",
        variant: "destructive",
        requiresComment: true,
      },
    ],
  };
}

function matchesFilters(todo: OpsTodo, filters: OpsTodoFilters): boolean {
  if (filters.type && todo.type !== filters.type) return false;
  if (filters.status && todo.status !== filters.status) return false;
  if (!filters.search) return true;

  const keyword = filters.search.trim().toLowerCase();
  if (!keyword) return true;

  return [
    todo.title,
    todo.subtitle,
    todo.statusLabel,
    todo.customerName ?? "",
    String(todo.amount ?? ""),
  ]
    .join(" ")
    .toLowerCase()
    .includes(keyword);
}

function summarize(todos: OpsTodo[]): OpsTodoSummary {
  return {
    total: todos.length,
    orders: todos.filter((todo) => todo.type === "order").length,
    refunds: todos.filter((todo) => todo.type === "refund").length,
    products: todos.filter((todo) => todo.type === "product").length,
  };
}

export async function listOpsTodos(
  filters: OpsTodoFilters
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
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.product.findMany({
      where: { status: "pending" },
      orderBy: { updatedAt: "desc" },
      take: 100,
    }),
  ]);

  const workflowTodos = instances
    .map((raw) => {
      const instance = {
        ...raw,
        context:
          typeof raw.context === "string"
            ? (JSON.parse(raw.context) as Record<string, unknown>)
            : (raw.context as Record<string, unknown>),
        workflow: {
          ...raw.workflow,
          nodes: JSON.parse(raw.workflow.nodes),
          edges: JSON.parse(raw.workflow.edges),
        },
      };

      if (instance.targetType === "order") return buildOrderTodo(instance);
      if (instance.targetType === "refund") return buildRefundTodo(instance);
      return null;
    })
    .filter((todo): todo is OpsTodo => todo !== null);

  const productTodos = products.map(buildProductTodo);

  const todos = [...workflowTodos, ...productTodos]
    .filter((todo) => matchesFilters(todo, filters))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return { summary: summarize(todos), todos };
}

function splitTodoId(todoId: string): { type: OpsTodoType; id: string } {
  const [type, ...rest] = todoId.split(":");
  const id = rest.join(":");
  if (
    (type !== "order" && type !== "refund" && type !== "product") ||
    id.length === 0
  ) {
    throw new Error("待办 ID 无效");
  }
  return { type, id };
}

async function findWorkflowTarget(
  instanceId: string,
  expectedType: OpsTodoType
): Promise<string> {
  const instance = await prisma.workflowInstance.findUnique({
    where: { id: instanceId },
    select: { targetId: true, targetType: true, status: true },
  });
  if (!instance || instance.targetType !== expectedType) {
    throw new Error("待办不存在");
  }
  if (instance.status !== "running") {
    throw new Error("待办已处理");
  }
  return instance.targetId;
}

export async function performOpsTodoAction(
  input: PerformOpsTodoActionInput
): Promise<{ success: true }> {
  const parsed = splitTodoId(input.todoId);
  const comment = input.comment ?? "";

  if (parsed.type === "order") {
    if (input.action !== "ship") throw new Error("订单动作无效");
    const orderId = await findWorkflowTarget(parsed.id, "order");
    await prisma.$transaction(async (tx) => {
      await transition({
        instanceId: parsed.id,
        trigger: "ship",
        operator: input.operator,
        comment,
      });
      await tx.order.update({
        where: { id: orderId },
        data: { status: "shipped" },
      });
    });
    return { success: true };
  }

  if (parsed.type === "refund") {
    const actionMap: Record<string, "approved" | "rejected" | "pending"> = {
      submit: "pending",
      cs_approve: "pending",
      cs_reject: "rejected",
      manager_approve: "approved",
      manager_reject: "rejected",
      reject: "rejected",
    };
    const nextRefundStatus = actionMap[input.action];
    if (!nextRefundStatus) throw new Error("退款动作无效");
    const refundId = await findWorkflowTarget(parsed.id, "refund");

    await prisma.$transaction(async (tx) => {
      await transition({
        instanceId: parsed.id,
        trigger: input.action,
        operator: input.operator,
        comment,
      });
      const refund = await prisma.refund.findUnique({
        where: { id: refundId },
      });
      if (!refund) throw new Error("退款单不存在");

      if (nextRefundStatus !== "pending") {
        await tx.refund.update({
          where: { id: refund.id },
          data: { status: nextRefundStatus },
        });
      }
      if (nextRefundStatus === "approved") {
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
  const nextStatus = input.action === "approve" ? "published" : "rejected";
  await prisma.product.update({
    where: { id: parsed.id },
    data: { status: nextStatus },
  });
  return { success: true };
}
```

- [ ] **Step 4: Run the service test to verify it passes**

Run:

```bash
npx vitest run src/server/operations/todos.test.ts
```

Expected: PASS.

- [ ] **Step 5: Run typecheck for the new service**

Run:

```bash
npm run typecheck
```

Expected: PASS. If TypeScript reports Prisma transaction typing issues, narrow the mocked test expectations first; do not replace service types with `any`.

- [ ] **Step 6: Commit Task 1**

Run:

```bash
git add src/server/operations/todos.ts src/server/operations/todos.test.ts
git commit -m "feat: add operations todo service"
```

---

### Task 2: Operations Todo API Routes

**Files:**
- Create: `src/app/api/ops/todos/route.ts`
- Create: `src/app/api/ops/todos/route.test.ts`
- Create: `src/app/api/ops/todos/[id]/action/route.ts`
- Create: `src/app/api/ops/todos/[id]/action/route.test.ts`

- [ ] **Step 1: Write failing GET route tests**

Create `src/app/api/ops/todos/route.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";

const mocks = vi.hoisted(() => ({
  PermissionDeniedError: class MockPermissionDeniedError extends Error {},
  requireStaff: vi.fn(),
  listOpsTodos: vi.fn(),
}));

vi.mock("@/server/auth/guards", () => ({
  PermissionDeniedError: mocks.PermissionDeniedError,
  requireStaff: mocks.requireStaff,
}));

vi.mock("@/server/operations/todos", () => ({
  listOpsTodos: mocks.listOpsTodos,
}));

describe("GET /api/ops/todos", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireStaff.mockResolvedValue({
      id: "operator-1",
      name: "运营小王",
      role: "operator",
    });
    mocks.listOpsTodos.mockResolvedValue({
      summary: { total: 0, orders: 0, refunds: 0, products: 0 },
      todos: [],
    });
  });

  it("passes filters to the operations todo service", async () => {
    const response = await GET(
      new NextRequest(
        "http://test.local/api/ops/todos?type=order&status=paid&search=ORD"
      )
    );

    expect(response.status).toBe(200);
    expect(mocks.listOpsTodos).toHaveBeenCalledWith({
      type: "order",
      status: "paid",
      search: "ORD",
    });
  });

  it("returns 403 when a customer tries to query operations todos", async () => {
    mocks.requireStaff.mockRejectedValue(new mocks.PermissionDeniedError());

    const response = await GET(
      new NextRequest("http://test.local/api/ops/todos")
    );

    expect(response.status).toBe(403);
    expect(mocks.listOpsTodos).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Write failing action route tests**

Create `src/app/api/ops/todos/[id]/action/route.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";

const mocks = vi.hoisted(() => ({
  PermissionDeniedError: class MockPermissionDeniedError extends Error {},
  requireStaff: vi.fn(),
  performOpsTodoAction: vi.fn(),
}));

vi.mock("@/server/auth/guards", () => ({
  PermissionDeniedError: mocks.PermissionDeniedError,
  requireStaff: mocks.requireStaff,
}));

vi.mock("@/server/operations/todos", () => ({
  performOpsTodoAction: mocks.performOpsTodoAction,
}));

describe("POST /api/ops/todos/[id]/action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireStaff.mockResolvedValue({
      id: "operator-1",
      name: "运营小王",
      role: "operator",
    });
    mocks.performOpsTodoAction.mockResolvedValue({ success: true });
  });

  it("delegates todo action to the operations service", async () => {
    const response = await POST(
      new NextRequest("http://test.local/api/ops/todos/order:abc/action", {
        method: "POST",
        body: JSON.stringify({ action: "ship", comment: "仓库已确认" }),
      }),
      { params: Promise.resolve({ id: "order:abc" }) }
    );

    expect(response.status).toBe(200);
    expect(mocks.performOpsTodoAction).toHaveBeenCalledWith({
      todoId: "order:abc",
      action: "ship",
      comment: "仓库已确认",
      operator: "运营小王",
    });
  });

  it("returns 400 when action is missing", async () => {
    const response = await POST(
      new NextRequest("http://test.local/api/ops/todos/order:abc/action", {
        method: "POST",
        body: JSON.stringify({ comment: "缺少动作" }),
      }),
      { params: Promise.resolve({ id: "order:abc" }) }
    );

    expect(response.status).toBe(400);
    expect(mocks.performOpsTodoAction).not.toHaveBeenCalled();
  });

  it("returns 403 when a customer tries to perform an action", async () => {
    mocks.requireStaff.mockRejectedValue(new mocks.PermissionDeniedError());

    const response = await POST(
      new NextRequest("http://test.local/api/ops/todos/order:abc/action", {
        method: "POST",
        body: JSON.stringify({ action: "ship" }),
      }),
      { params: Promise.resolve({ id: "order:abc" }) }
    );

    expect(response.status).toBe(403);
    expect(mocks.performOpsTodoAction).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Run route tests to verify they fail**

Run:

```bash
npx vitest run src/app/api/ops/todos/route.test.ts src/app/api/ops/todos/[id]/action/route.test.ts
```

Expected: FAIL because the API routes do not exist.

- [ ] **Step 4: Implement `GET /api/ops/todos`**

Create `src/app/api/ops/todos/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/server/auth/guards";
import { errorResponse } from "@/server/shared/api";
import { listOpsTodos, type OpsTodoType } from "@/server/operations/todos";

function parseType(value: string | null): OpsTodoType | undefined {
  if (value === "order" || value === "refund" || value === "product") {
    return value;
  }
  return undefined;
}

export async function GET(req: NextRequest) {
  try {
    await requireStaff();
    const { searchParams } = new URL(req.url);

    const result = await listOpsTodos({
      type: parseType(searchParams.get("type")),
      status: searchParams.get("status") || undefined,
      search: searchParams.get("search") || undefined,
    });

    return NextResponse.json(result);
  } catch (error: unknown) {
    return errorResponse(error);
  }
}
```

- [ ] **Step 5: Implement `POST /api/ops/todos/[id]/action`**

Create `src/app/api/ops/todos/[id]/action/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/server/auth/guards";
import { badRequest, errorResponse } from "@/server/shared/api";
import { performOpsTodoAction } from "@/server/operations/todos";

type RouteParamsContext = {
  params: Promise<{ id: string }>;
};

export async function POST(req: NextRequest, ctx: RouteParamsContext) {
  try {
    const user = await requireStaff();
    const { id } = await ctx.params;
    const body = await req.json();

    if (typeof body.action !== "string" || body.action.length === 0) {
      return badRequest(new Error("动作不能为空"));
    }

    const result = await performOpsTodoAction({
      todoId: id,
      action: body.action,
      comment: typeof body.comment === "string" ? body.comment : "",
      operator: user.name ?? "unknown",
    });

    return NextResponse.json(result);
  } catch (error: unknown) {
    return errorResponse(error);
  }
}
```

- [ ] **Step 6: Run route tests to verify they pass**

Run:

```bash
npx vitest run src/app/api/ops/todos/route.test.ts src/app/api/ops/todos/[id]/action/route.test.ts
```

Expected: PASS.

- [ ] **Step 7: Run combined service and route tests**

Run:

```bash
npx vitest run src/server/operations/todos.test.ts src/app/api/ops/todos/route.test.ts src/app/api/ops/todos/[id]/action/route.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit Task 2**

Run:

```bash
git add src/app/api/ops/todos src/server/operations
git commit -m "feat: add operations todo api"
```

---

### Task 3: Dashboard Workbench UI

**Files:**
- Modify: `src/app/dashboard/page.tsx`

- [ ] **Step 1: Replace workflow-instance types with operations todo types**

In `src/app/dashboard/page.tsx`, define these client-side interfaces near the imports:

```ts
interface OpsTodoAction {
  key: string;
  label: string;
  variant: "default" | "outline" | "destructive";
  requiresComment?: boolean;
}

interface OpsTodo {
  id: string;
  type: "order" | "refund" | "product";
  title: string;
  subtitle: string;
  status: string;
  statusLabel: string;
  statusTone: "yellow" | "blue" | "green" | "red" | "gray" | "orange";
  targetId: string;
  workflowInstanceId?: string;
  amount?: number;
  customerName?: string;
  createdAt: string;
  actions: OpsTodoAction[];
}

interface OpsTodoSummary {
  total: number;
  orders: number;
  refunds: number;
  products: number;
}

interface OpsTodoListResponse {
  summary: OpsTodoSummary;
  todos: OpsTodo[];
}
```

- [ ] **Step 2: Add formatting and style helpers**

Add these helpers in `src/app/dashboard/page.tsx`:

```ts
const typeLabels = {
  order: "订单",
  refund: "退款",
  product: "商品审核",
} as const;

const toneClasses: Record<OpsTodo["statusTone"], string> = {
  yellow: "bg-yellow-100 text-yellow-800",
  blue: "bg-blue-100 text-blue-800",
  green: "bg-green-100 text-green-800",
  red: "bg-red-100 text-red-800",
  gray: "bg-gray-100 text-gray-800",
  orange: "bg-orange-100 text-orange-800",
};

function formatMoney(value: number | undefined): string {
  if (value === undefined) return "未记录金额";
  return `¥${(value / 100).toFixed(2)}`;
}

function formatTime(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
```

- [ ] **Step 3: Replace React Query calls**

Use these state values and query/mutation definitions:

```ts
const queryClient = useQueryClient();
const [type, setType] = useState<"all" | OpsTodo["type"]>("all");
const [status, setStatus] = useState("all");
const [search, setSearch] = useState("");

const query = new URLSearchParams();
if (type !== "all") query.set("type", type);
if (status !== "all") query.set("status", status);
if (search.trim()) query.set("search", search.trim());

const { data, isLoading, isError } = useQuery<OpsTodoListResponse>({
  queryKey: ["ops-todos", type, status, search],
  queryFn: () =>
    fetch(`/api/ops/todos?${query.toString()}`).then((response) => {
      if (!response.ok) throw new Error("加载运营待办失败");
      return response.json();
    }),
  refetchInterval: 5000,
});

const actionMutation = useMutation({
  mutationFn: ({ todo, action }: { todo: OpsTodo; action: OpsTodoAction }) =>
    fetch(`/api/ops/todos/${encodeURIComponent(todo.id)}/action`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: action.key }),
    }).then(async (response) => {
      if (!response.ok) {
        const body = await response.json();
        throw new Error(body.error || "操作失败");
      }
      return response.json();
    }),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["ops-todos"] });
    toast.success("操作成功");
  },
  onError: (error: Error) => toast.error(error.message || "操作失败"),
});
```

- [ ] **Step 4: Render summary cards**

Replace the old heading/tabs block with:

```tsx
const summary = data?.summary ?? {
  total: 0,
  orders: 0,
  refunds: 0,
  products: 0,
};

return (
  <div className="space-y-6">
    <div>
      <h1 className="text-2xl font-bold">运营工作台</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        集中处理订单发货、退款审批和商品上架审核。
      </p>
    </div>

    <div className="grid gap-3 md:grid-cols-4">
      <Card>
        <CardContent className="p-4">
          <p className="text-sm text-muted-foreground">待处理</p>
          <p className="mt-2 text-2xl font-semibold">{summary.total}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <p className="text-sm text-muted-foreground">订单待发货</p>
          <p className="mt-2 text-2xl font-semibold">{summary.orders}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <p className="text-sm text-muted-foreground">退款待审核</p>
          <p className="mt-2 text-2xl font-semibold">{summary.refunds}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <p className="text-sm text-muted-foreground">商品待审核</p>
          <p className="mt-2 text-2xl font-semibold">{summary.products}</p>
        </CardContent>
      </Card>
    </div>
  </div>
);
```

Keep this structure and add the toolbar/list in the next steps inside the same root `<div>`.

- [ ] **Step 5: Add toolbar filters**

Inside the root `<div className="space-y-6">`, after summary cards, add:

```tsx
<Card>
  <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-center">
    <div className="flex gap-2">
      {[
        { key: "all", label: "全部" },
        { key: "order", label: "订单" },
        { key: "refund", label: "退款" },
        { key: "product", label: "商品审核" },
      ].map((item) => (
        <Button
          key={item.key}
          type="button"
          variant={type === item.key ? "default" : "outline"}
          size="sm"
          onClick={() => setType(item.key as typeof type)}
        >
          {item.label}
        </Button>
      ))}
    </div>
    <select
      value={status}
      onChange={(event) => setStatus(event.target.value)}
      className="h-9 rounded-md border bg-background px-3 text-sm"
    >
      <option value="all">全部状态</option>
      <option value="paid">已支付</option>
      <option value="pending_review">待审核</option>
      <option value="cs_review">客服审核</option>
      <option value="manager_approval">经理审批</option>
      <option value="pending">商品待审核</option>
    </select>
    <Input
      value={search}
      onChange={(event) => setSearch(event.target.value)}
      placeholder="搜索订单号、商品名、退款原因"
      className="md:ml-auto md:max-w-xs"
    />
  </CardContent>
</Card>
```

- [ ] **Step 6: Add todo list rendering**

Add this rendering block after the toolbar:

```tsx
<div className="grid gap-3">
  {isLoading && (
    <Card>
      <CardContent className="p-6 text-sm text-muted-foreground">
        正在加载运营待办...
      </CardContent>
    </Card>
  )}

  {isError && (
    <Card>
      <CardContent className="p-6 text-sm text-red-600">
        运营待办加载失败，请稍后重试。
      </CardContent>
    </Card>
  )}

  {!isLoading && !isError && data?.todos.length === 0 && (
    <Card>
      <CardContent className="p-6 text-sm text-muted-foreground">
        当前没有需要处理的待办。
      </CardContent>
    </Card>
  )}

  {data?.todos.map((todo) => (
    <Card key={todo.id}>
      <CardContent className="flex flex-col gap-4 p-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{typeLabels[todo.type]}</Badge>
            <Badge className={toneClasses[todo.statusTone]}>
              {todo.statusLabel}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {formatTime(todo.createdAt)}
            </span>
          </div>
          <div>
            <h2 className="font-semibold">{todo.title}</h2>
            <p className="text-sm text-muted-foreground">{todo.subtitle}</p>
          </div>
          <p className="text-sm text-muted-foreground">
            金额：{formatMoney(todo.amount)}
          </p>
        </div>

        <div className="flex flex-wrap gap-2 md:justify-end">
          {todo.actions.map((action) => (
            <Button
              key={action.key}
              size="sm"
              variant={action.variant}
              disabled={actionMutation.isPending}
              onClick={() => actionMutation.mutate({ todo, action })}
            >
              {action.label}
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  ))}
</div>
```

- [ ] **Step 7: Remove unused imports and old workflow code**

Remove these old pieces from `src/app/dashboard/page.tsx`:

- `Tabs`, `TabsContent`, `TabsList`, `TabsTrigger` imports if no longer used.
- `WorkflowNodeView`, `WorkflowEdgeView`, `WorkflowLogView`, `WorkflowInstanceView`, `WorkflowInstancesResponse`.
- `nodeColors`.
- `activeTab`.
- `orderData`, `approvalData`, `transitionMutation`, `nextTrigger`, and `renderInstances`.

- [ ] **Step 8: Run typecheck and lint for the dashboard**

Run:

```bash
npm run typecheck
npm run lint
```

Expected: PASS.

- [ ] **Step 9: Commit Task 3**

Run:

```bash
git add src/app/dashboard/page.tsx
git commit -m "feat: replace dashboard with operations workbench"
```

---

### Task 4: Final Verification And PR Preparation

**Files:**
- No source files expected unless verification reveals a concrete issue.

- [ ] **Step 1: Run targeted operations tests**

Run:

```bash
npx vitest run src/server/operations/todos.test.ts src/app/api/ops/todos/route.test.ts src/app/api/ops/todos/[id]/action/route.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run the full test suite**

Run:

```bash
npm run test
```

Expected: PASS with all test files passing.

- [ ] **Step 3: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 4: Run lint**

Run:

```bash
npm run lint
```

Expected: PASS.

- [ ] **Step 5: Validate Prisma schema**

If `.env` is missing in the worktree, copy `.env.example` to `.env` before this check:

```powershell
Copy-Item .env.example .env
npx prisma validate
```

Expected: PASS. `.env` must stay untracked.

- [ ] **Step 6: Run production build**

Run:

```bash
npm run build
```

Expected: PASS. A Next.js multi-lockfile warning is acceptable in this worktree setup.

- [ ] **Step 7: Check for explicit `any` additions**

Run:

```bash
rg -n "as any|: any|catch \(e: any\)|any\[\]" src
```

Expected: no matches from new code.

- [ ] **Step 8: Inspect final git state**

Run:

```bash
git status --short --branch
git log --oneline -8
```

Expected: clean worktree and commits for design, plan, service, API, and dashboard.

- [ ] **Step 9: Prepare PR summary**

Use this PR body:

```markdown
## Summary
- Add a server-side operations todo layer for order, refund, and product approval work.
- Add operations todo API routes for querying and processing staff todos.
- Replace the dashboard with a commercial-style operations workbench.

## Test Plan
- [ ] npm run test
- [ ] npm run typecheck
- [ ] npm run lint
- [ ] npx prisma validate
- [ ] npm run build
```

- [ ] **Step 10: Commit any verification-only fixes**

If verification required a code fix, commit it with a focused message:

```bash
git add <fixed-files>
git commit -m "fix: stabilize operations workbench"
```

If no fixes were needed, do not create an empty commit.
