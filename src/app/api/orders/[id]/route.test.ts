import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";

const mocks = vi.hoisted(() => ({
  orderFindFirst: vi.fn(),
  orderFindUnique: vi.fn(),
  requireAuth: vi.fn(),
  workflowInstanceFindMany: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    order: {
      findFirst: mocks.orderFindFirst,
      findUnique: mocks.orderFindUnique,
    },
    workflowInstance: {
      findMany: mocks.workflowInstanceFindMany,
    },
  },
}));

vi.mock("@/server/auth/guards", () => ({
  requireAuth: mocks.requireAuth,
}));

describe("GET /api/orders/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("客户只能按自己的 userId 查询订单详情", async () => {
    mocks.requireAuth.mockResolvedValue({
      id: "user-1",
      name: "Customer",
      email: "customer@example.com",
      role: "customer",
    });
    mocks.orderFindFirst.mockResolvedValue(null);

    const response = await GET(
      new NextRequest("http://test.local/api/orders/order-1"),
      {
        params: Promise.resolve({ id: "order-1" }),
      }
    );

    expect(mocks.orderFindFirst).toHaveBeenCalledWith({
      where: { id: "order-1", userId: "user-1" },
      include: {
        items: { include: { product: true } },
        user: { select: { name: true, email: true } },
      },
    });
    expect(mocks.workflowInstanceFindMany).not.toHaveBeenCalled();
    expect(response.status).toBe(404);
  });

  it("运营角色按订单 id 查询详情", async () => {
    mocks.requireAuth.mockResolvedValue({
      id: "operator-1",
      name: "Operator",
      email: "operator@example.com",
      role: "operator",
    });
    mocks.orderFindFirst.mockResolvedValue({
      id: "order-1",
      userId: "user-1",
    });
    mocks.workflowInstanceFindMany.mockResolvedValue([]);

    const response = await GET(
      new NextRequest("http://test.local/api/orders/order-1"),
      {
        params: Promise.resolve({ id: "order-1" }),
      }
    );

    expect(mocks.orderFindFirst).toHaveBeenCalledWith({
      where: { id: "order-1" },
      include: {
        items: { include: { product: true } },
        user: { select: { name: true, email: true } },
      },
    });
    expect(response.status).toBe(200);
  });
});
