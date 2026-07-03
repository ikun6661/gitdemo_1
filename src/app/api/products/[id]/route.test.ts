import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";

const mocks = vi.hoisted(() => ({
  AuthRequiredError: class MockAuthRequiredError extends Error {},
  PermissionDeniedError: class MockPermissionDeniedError extends Error {},
  productFindUnique: vi.fn(),
  requireStaff: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    product: {
      findUnique: mocks.productFindUnique,
    },
  },
}));

vi.mock("@/server/auth/guards", () => {
  return {
    AuthRequiredError: mocks.AuthRequiredError,
    PermissionDeniedError: mocks.PermissionDeniedError,
    requireStaff: mocks.requireStaff,
  };
});

describe("GET /api/products/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("匿名不能读取 draft 商品", async () => {
    mocks.requireStaff.mockRejectedValue(new mocks.AuthRequiredError());
    mocks.productFindUnique.mockResolvedValue({
      id: "product-1",
      status: "draft",
    });

    const response = await GET(
      new NextRequest("http://test.local/api/products/product-1"),
      { params: Promise.resolve({ id: "product-1" }) }
    );

    expect(response.status).toBe(404);
  });

  it("staff 可以读取 draft 商品", async () => {
    mocks.requireStaff.mockResolvedValue({
      id: "operator-1",
      name: "Operator",
      email: "operator@example.com",
      role: "operator",
    });
    mocks.productFindUnique.mockResolvedValue({
      id: "product-1",
      status: "draft",
    });

    const response = await GET(
      new NextRequest("http://test.local/api/products/product-1"),
      { params: Promise.resolve({ id: "product-1" }) }
    );

    expect(response.status).toBe(200);
  });
});
