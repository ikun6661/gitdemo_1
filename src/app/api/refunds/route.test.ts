import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST } from "./route";

const mocks = vi.hoisted(() => ({
  orderFindFirst: vi.fn(),
  orderFindUnique: vi.fn(),
  refundCreate: vi.fn(),
  refundFindMany: vi.fn(),
  requireAuth: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    refund: {
      create: mocks.refundCreate,
      findMany: mocks.refundFindMany,
    },
    order: {
      findFirst: mocks.orderFindFirst,
      findUnique: mocks.orderFindUnique,
    },
  },
}));

vi.mock("@/server/auth/guards", () => ({
  requireAuth: mocks.requireAuth,
}));

vi.mock("@/server/workflow/engine", () => ({
  createInstance: vi.fn(),
}));

describe("/api/refunds", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("客户只能查询自己的退款列表", async () => {
    mocks.requireAuth.mockResolvedValue({
      id: "user-1",
      name: "Customer",
      email: "customer@example.com",
      role: "customer",
    });
    mocks.refundFindMany.mockResolvedValue([]);

    const response = await GET();

    expect(mocks.refundFindMany).toHaveBeenCalledWith({
      where: { userId: "user-1" },
      include: {
        order: true,
        user: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    expect(response.status).toBe(200);
  });

  it("客户申请退款时只能查询自己的订单", async () => {
    mocks.requireAuth.mockResolvedValue({
      id: "user-1",
      name: "Customer",
      email: "customer@example.com",
      role: "customer",
    });
    mocks.orderFindFirst.mockResolvedValue(null);

    const response = await POST(
      new NextRequest("http://test.local/api/refunds", {
        method: "POST",
        body: JSON.stringify({
          orderId: "order-1",
          reason: "不需要了",
        }),
      })
    );

    expect(mocks.orderFindFirst).toHaveBeenCalledWith({
      where: { id: "order-1", userId: "user-1" },
    });
    expect(mocks.refundCreate).not.toHaveBeenCalled();
    expect(response.status).toBe(404);
  });
});
