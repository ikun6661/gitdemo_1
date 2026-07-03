import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";

const mocks = vi.hoisted(() => ({
  AuthRequiredError: class MockAuthRequiredError extends Error {},
  cartItemCreate: vi.fn(),
  cartItemFindUnique: vi.fn(),
  cartItemUpdate: vi.fn(),
  PermissionDeniedError: class MockPermissionDeniedError extends Error {},
  productFindFirst: vi.fn(),
  requireAuth: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    cartItem: {
      create: mocks.cartItemCreate,
      findUnique: mocks.cartItemFindUnique,
      update: mocks.cartItemUpdate,
    },
    product: {
      findFirst: mocks.productFindFirst,
    },
  },
}));

vi.mock("@/server/auth/guards", () => ({
  AuthRequiredError: mocks.AuthRequiredError,
  PermissionDeniedError: mocks.PermissionDeniedError,
  requireAuth: mocks.requireAuth,
}));

describe("POST /api/cart", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAuth.mockResolvedValue({
      id: "user-1",
      name: "Customer",
      email: "customer@example.com",
      role: "customer",
    });
    mocks.cartItemCreate.mockResolvedValue({
      id: "cart-1",
      userId: "user-1",
      productId: "product-draft",
      quantity: 2,
    });
  });

  it("draft 商品不可加入购物车且不会创建或更新购物车项", async () => {
    mocks.productFindFirst.mockResolvedValue(null);

    const response = await POST(
      new NextRequest("http://test.local/api/cart", {
        method: "POST",
        body: JSON.stringify({
          productId: "product-draft",
          quantity: 2,
        }),
      })
    );

    expect(response.status).toBe(400);
    expect(mocks.productFindFirst).toHaveBeenCalledWith({
      where: { id: "product-draft", status: "published" },
      select: { id: true },
    });
    expect(mocks.cartItemFindUnique).not.toHaveBeenCalled();
    expect(mocks.cartItemCreate).not.toHaveBeenCalled();
    expect(mocks.cartItemUpdate).not.toHaveBeenCalled();
  });

  it("published 商品可以加入购物车", async () => {
    mocks.productFindFirst.mockResolvedValue({ id: "product-1" });
    mocks.cartItemFindUnique.mockResolvedValue(null);
    mocks.cartItemCreate.mockResolvedValue({
      id: "cart-1",
      userId: "user-1",
      productId: "product-1",
      quantity: 1,
    });

    const response = await POST(
      new NextRequest("http://test.local/api/cart", {
        method: "POST",
        body: JSON.stringify({
          productId: "product-1",
          quantity: 1,
        }),
      })
    );

    expect(response.status).toBe(201);
    expect(mocks.cartItemCreate).toHaveBeenCalledWith({
      data: { userId: "user-1", productId: "product-1", quantity: 1 },
    });
  });
});
