import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";

const mocks = vi.hoisted(() => ({
  AuthRequiredError: class MockAuthRequiredError extends Error {},
  cartItemDeleteMany: vi.fn(),
  cartItemFindMany: vi.fn(),
  createInstance: vi.fn(),
  orderCreate: vi.fn(),
  PermissionDeniedError: class MockPermissionDeniedError extends Error {},
  productUpdate: vi.fn(),
  requireAuth: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: mocks.transaction,
    cartItem: {
      findMany: mocks.cartItemFindMany,
    },
  },
}));

vi.mock("@/server/auth/guards", () => ({
  AuthRequiredError: mocks.AuthRequiredError,
  PermissionDeniedError: mocks.PermissionDeniedError,
  requireAuth: mocks.requireAuth,
}));

vi.mock("@/server/workflow/engine", () => ({
  createInstance: mocks.createInstance,
}));

describe("POST /api/orders", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAuth.mockResolvedValue({
      id: "user-1",
      name: "Customer",
      email: "customer@example.com",
      role: "customer",
    });
    mocks.transaction.mockImplementation(async (callback) =>
      callback({
        cartItem: { deleteMany: mocks.cartItemDeleteMany },
        order: { create: mocks.orderCreate },
        product: { update: mocks.productUpdate },
      })
    );
  });

  it("混入无效或他人购物车项时返回 400 且不创建订单", async () => {
    mocks.cartItemFindMany.mockResolvedValue([
      {
        id: "cart-1",
        quantity: 1,
        product: {
          id: "product-1",
          name: "Phone",
          price: 100,
          stock: 5,
          status: "published",
          images: "[]",
        },
      },
    ]);

    const response = await POST(
      new NextRequest("http://test.local/api/orders", {
        method: "POST",
        body: JSON.stringify({
          address: { name: "Customer" },
          cartItemIds: ["cart-1", "cart-2"],
        }),
      })
    );

    expect(response.status).toBe(400);
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.orderCreate).not.toHaveBeenCalled();
    expect(mocks.cartItemDeleteMany).not.toHaveBeenCalled();
  });

  it("购物车项 id 类型无效时返回 400 且不查询数据库", async () => {
    const response = await POST(
      new NextRequest("http://test.local/api/orders", {
        method: "POST",
        body: JSON.stringify({
          address: { name: "Customer" },
          cartItemIds: ["cart-1", 123],
        }),
      })
    );

    expect(response.status).toBe(400);
    expect(mocks.cartItemFindMany).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("正常下单删除购物车时带上 userId", async () => {
    mocks.cartItemFindMany.mockResolvedValue([
      {
        id: "cart-1",
        quantity: 2,
        product: {
          id: "product-1",
          name: "Phone",
          price: 100,
          stock: 5,
          status: "published",
          images: "[]",
        },
      },
    ]);
    mocks.orderCreate.mockResolvedValue({ id: "order-1" });
    mocks.productUpdate.mockResolvedValue({});
    mocks.cartItemDeleteMany.mockResolvedValue({ count: 1 });
    mocks.createInstance.mockResolvedValue({});

    const response = await POST(
      new NextRequest("http://test.local/api/orders", {
        method: "POST",
        body: JSON.stringify({
          address: { name: "Customer" },
          cartItemIds: ["cart-1"],
        }),
      })
    );

    expect(response.status).toBe(201);
    expect(mocks.cartItemDeleteMany).toHaveBeenCalledWith({
      where: { id: { in: ["cart-1"] }, userId: "user-1" },
    });
  });

  it("旧购物车里的 draft 商品结算时返回 400 且不进入事务", async () => {
    mocks.cartItemFindMany.mockResolvedValue([
      {
        id: "cart-1",
        quantity: 1,
        product: {
          id: "product-draft",
          name: "Draft Phone",
          price: 100,
          stock: 5,
          status: "draft",
          images: "[]",
        },
      },
    ]);

    const response = await POST(
      new NextRequest("http://test.local/api/orders", {
        method: "POST",
        body: JSON.stringify({
          address: { name: "Customer" },
          cartItemIds: ["cart-1"],
        }),
      })
    );

    expect(response.status).toBe(400);
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.orderCreate).not.toHaveBeenCalled();
    expect(mocks.productUpdate).not.toHaveBeenCalled();
    expect(mocks.cartItemDeleteMany).not.toHaveBeenCalled();
  });
});
