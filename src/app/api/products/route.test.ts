import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";

const mocks = vi.hoisted(() => ({
  AuthRequiredError: class MockAuthRequiredError extends Error {},
  PermissionDeniedError: class MockPermissionDeniedError extends Error {},
  productCount: vi.fn(),
  productFindMany: vi.fn(),
  requireStaff: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    product: {
      count: mocks.productCount,
      findMany: mocks.productFindMany,
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

describe("GET /api/products", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.productFindMany.mockResolvedValue([]);
    mocks.productCount.mockResolvedValue(0);
  });

  it("未授权查询 draft 时仍只返回 published", async () => {
    mocks.requireStaff.mockRejectedValue(new mocks.AuthRequiredError());

    const response = await GET(
      new NextRequest("http://test.local/api/products?status=draft")
    );

    expect(response.status).toBe(200);
    expect(mocks.productFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: "published" } })
    );
    expect(mocks.productCount).toHaveBeenCalledWith({
      where: { status: "published" },
    });
  });

  it("customer 查询 draft 时仍只返回 published", async () => {
    mocks.requireStaff.mockRejectedValue(new mocks.PermissionDeniedError());

    const response = await GET(
      new NextRequest("http://test.local/api/products?status=draft")
    );

    expect(response.status).toBe(200);
    expect(mocks.productFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: "published" } })
    );
    expect(mocks.productCount).toHaveBeenCalledWith({
      where: { status: "published" },
    });
  });

  it("staff 传空 status 时查询全部状态", async () => {
    mocks.requireStaff.mockResolvedValue({
      id: "operator-1",
      name: "Operator",
      email: "operator@example.com",
      role: "operator",
    });

    const response = await GET(
      new NextRequest("http://test.local/api/products?status=&search=phone")
    );

    expect(response.status).toBe(200);
    expect(mocks.productFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { name: { contains: "phone" } } })
    );
    expect(mocks.productCount).toHaveBeenCalledWith({
      where: { name: { contains: "phone" } },
    });
  });
});
