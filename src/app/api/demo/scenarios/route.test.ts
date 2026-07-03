import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";

const mocks = vi.hoisted(() => ({
  AuthRequiredError: class MockAuthRequiredError extends Error {},
  createInstance: vi.fn(),
  orderCreate: vi.fn(),
  PermissionDeniedError: class MockPermissionDeniedError extends Error {},
  productFindFirst: vi.fn(),
  requireStaff: vi.fn(),
  userFindFirst: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    order: {
      create: mocks.orderCreate,
    },
    product: {
      findFirst: mocks.productFindFirst,
    },
    user: {
      findFirst: mocks.userFindFirst,
    },
  },
}));

vi.mock("@/server/auth/guards", () => ({
  AuthRequiredError: mocks.AuthRequiredError,
  PermissionDeniedError: mocks.PermissionDeniedError,
  requireStaff: mocks.requireStaff,
}));

vi.mock("@/server/workflow/engine", () => ({
  createInstance: mocks.createInstance,
}));

describe("POST /api/demo/scenarios", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("customer 不能创建演示场景数据", async () => {
    mocks.requireStaff.mockRejectedValue(new mocks.PermissionDeniedError());

    const response = await POST(
      new NextRequest("http://test.local/api/demo/scenarios", {
        method: "POST",
        body: JSON.stringify({ scenario: "order_flow" }),
      })
    );

    expect(response.status).toBe(403);
    expect(mocks.orderCreate).not.toHaveBeenCalled();
    expect(mocks.createInstance).not.toHaveBeenCalled();
  });
});
