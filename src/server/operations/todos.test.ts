import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildOrderTodo,
  buildProductTodo,
  buildRefundTodo,
  listOpsTodos,
  performOpsTodoAction,
} from "./todos";

const mocks = vi.hoisted(() => ({
  orderUpdate: vi.fn(),
  productFindMany: vi.fn(),
  productFindUnique: vi.fn(),
  productUpdate: vi.fn(),
  refundFindUnique: vi.fn(),
  refundUpdate: vi.fn(),
  transaction: vi.fn(),
  transition: vi.fn(),
  workflowInstanceFindMany: vi.fn(),
  workflowInstanceFindUnique: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: mocks.transaction,
    order: {
      update: mocks.orderUpdate,
    },
    product: {
      findMany: mocks.productFindMany,
      findUnique: mocks.productFindUnique,
      update: mocks.productUpdate,
    },
    refund: {
      findUnique: mocks.refundFindUnique,
      update: mocks.refundUpdate,
    },
    workflowInstance: {
      findMany: mocks.workflowInstanceFindMany,
      findUnique: mocks.workflowInstanceFindUnique,
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
  status: "running",
  createdAt: new Date("2026-07-03T08:00:00.000Z"),
  context: {
    orderNo: "ORD-20260703-ABC123",
    amount: 259900,
  },
  workflow: {
    id: "workflow-order",
    name: "订单流程",
    type: "order_flow",
    nodes: [{ key: "paid", label: "已支付" }],
    edges: [{ from: "paid", to: "shipped", trigger: "ship", label: "发货" }],
    createdAt: new Date("2026-07-03T07:00:00.000Z"),
  },
  logs: [],
};

const refundInstance = {
  id: "workflow-refund-1",
  targetType: "refund",
  targetId: "refund-1",
  currentNode: "manager_approval",
  status: "running",
  createdAt: new Date("2026-07-03T09:00:00.000Z"),
  context: {
    orderNo: "ORD-20260703-REFUND",
    reason: "7 天无理由",
    amount: 109900,
  },
  workflow: {
    id: "workflow-refund",
    name: "退款审批",
    type: "refund_approval",
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
    createdAt: new Date("2026-07-03T07:30:00.000Z"),
  },
  logs: [],
};

const pendingProduct = {
  id: "product-1",
  name: "AirPods Max",
  status: "pending",
  price: 439900,
  stock: 30,
  createdAt: new Date("2026-07-03T10:00:00.000Z"),
  updatedAt: new Date("2026-07-03T10:00:00.000Z"),
};

describe("operations todos", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.workflowInstanceFindMany.mockResolvedValue([]);
    mocks.workflowInstanceFindUnique.mockResolvedValue(null);
    mocks.productFindMany.mockResolvedValue([]);
    mocks.transaction.mockImplementation(async (callback) =>
      callback({
        order: { update: mocks.orderUpdate },
        refund: {
          findUnique: mocks.refundFindUnique,
          update: mocks.refundUpdate,
        },
      }),
    );
  });

  it("paid 订单生成 ship 待办", () => {
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

  it("pending_payment 订单不生成待办", () => {
    expect(
      buildOrderTodo({ ...orderInstance, currentNode: "pending_payment" }),
    ).toBeNull();
  });

  it("manager_approval 退款生成 manager_approve 和 manager_reject", () => {
    const todo = buildRefundTodo(refundInstance);

    expect(todo).toMatchObject({
      id: "refund:workflow-refund-1",
      type: "refund",
      title: "退款 ORD-20260703-REFUND",
      status: "manager_approval",
      targetId: "refund-1",
      workflowInstanceId: "workflow-refund-1",
      amount: 109900,
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

  it("pending 商品生成 approve 和 reject", () => {
    const todo = buildProductTodo(pendingProduct);

    expect(todo).toMatchObject({
      id: "product:product-1",
      type: "product",
      title: "商品 AirPods Max",
      status: "pending",
      targetId: "product-1",
      amount: 439900,
    });
    expect(todo.actions).toEqual([
      { key: "approve", label: "通过上架", variant: "default" },
      {
        key: "reject",
        label: "驳回",
        variant: "destructive",
        requiresComment: true,
      },
    ]);
  });

  it("listOpsTodos 聚合三类待办和 summary", async () => {
    mocks.workflowInstanceFindMany.mockResolvedValue([
      {
        ...orderInstance,
        context: JSON.stringify(orderInstance.context),
        workflow: {
          ...orderInstance.workflow,
          nodes: JSON.stringify(orderInstance.workflow.nodes),
          edges: JSON.stringify(orderInstance.workflow.edges),
        },
      },
      {
        ...refundInstance,
        context: JSON.stringify(refundInstance.context),
        workflow: {
          ...refundInstance.workflow,
          nodes: JSON.stringify(refundInstance.workflow.nodes),
          edges: JSON.stringify(refundInstance.workflow.edges),
        },
      },
    ]);
    mocks.productFindMany.mockResolvedValue([pendingProduct]);

    const result = await listOpsTodos({});

    expect(mocks.workflowInstanceFindMany).toHaveBeenCalledWith({
      where: {
        status: "running",
        targetType: { in: ["order", "refund", "product"] },
      },
      include: {
        workflow: true,
        logs: { orderBy: { createdAt: "asc" } },
      },
    });
    expect(mocks.productFindMany).toHaveBeenCalledWith({
      where: { status: "pending" },
    });
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

  it("order ship 会调用 transition 并更新 order status", async () => {
    mocks.workflowInstanceFindUnique.mockResolvedValue({
      id: "workflow-order-1",
      targetId: "order-1",
      targetType: "order",
      status: "running",
    });
    mocks.transition.mockResolvedValue({
      instance: { id: "workflow-order-1", currentNode: "shipped" },
      fromNode: "paid",
      toNode: "shipped",
      isEnd: false,
    });

    await expect(
      performOpsTodoAction({
        todoId: "order:workflow-order-1",
        action: "ship",
        operator: "运营小王",
      }),
    ).resolves.toEqual({ success: true });

    expect(mocks.workflowInstanceFindUnique).toHaveBeenCalledWith({
      where: { id: "workflow-order-1" },
      select: { targetId: true, targetType: true, status: true },
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

  it("manager_approve 退款会更新 refund approved 和 order refunded", async () => {
    mocks.workflowInstanceFindUnique.mockResolvedValue({
      id: "workflow-refund-1",
      targetId: "refund-1",
      targetType: "refund",
      status: "running",
    });
    mocks.refundFindUnique.mockResolvedValue({
      id: "refund-1",
      orderId: "order-1",
      status: "pending",
    });
    mocks.transition.mockResolvedValue({
      instance: { id: "workflow-refund-1", currentNode: "approved" },
      fromNode: "manager_approval",
      toNode: "approved",
      isEnd: true,
    });

    await expect(
      performOpsTodoAction({
        todoId: "refund:workflow-refund-1",
        action: "manager_approve",
        operator: "运营小王",
      }),
    ).resolves.toEqual({ success: true });

    expect(mocks.refundFindUnique).toHaveBeenCalledWith({
      where: { id: "refund-1" },
      select: { orderId: true },
    });
    expect(mocks.transition).toHaveBeenCalledWith({
      instanceId: "workflow-refund-1",
      trigger: "manager_approve",
      operator: "运营小王",
      comment: "",
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

  it("product reject 会更新 product rejected 且不调用 transition", async () => {
    mocks.productFindUnique.mockResolvedValue({
      id: "product-1",
      status: "pending",
    });

    await expect(
      performOpsTodoAction({
        todoId: "product:product-1",
        action: "reject",
        operator: "运营小王",
        comment: "图片不清晰",
      }),
    ).resolves.toEqual({ success: true });

    expect(mocks.productFindUnique).toHaveBeenCalledWith({
      where: { id: "product-1" },
      select: { id: true, status: true },
    });
    expect(mocks.transition).not.toHaveBeenCalled();
    expect(mocks.productUpdate).toHaveBeenCalledWith({
      where: { id: "product-1" },
      data: { status: "rejected" },
    });
  });
});
