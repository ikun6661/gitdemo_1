import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const mocks = vi.hoisted(() => ({
  AuthRequiredError: class MockAuthRequiredError extends Error {},
  orderDeleteMany: vi.fn(),
  orderFindMany: vi.fn(),
  orderItemDeleteMany: vi.fn(),
  PermissionDeniedError: class MockPermissionDeniedError extends Error {},
  refundDeleteMany: vi.fn(),
  requireStaff: vi.fn(),
  workflowInstanceDeleteMany: vi.fn(),
  workflowInstanceFindMany: vi.fn(),
  workflowLogDeleteMany: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    order: {
      deleteMany: mocks.orderDeleteMany,
      findMany: mocks.orderFindMany,
    },
    orderItem: {
      deleteMany: mocks.orderItemDeleteMany,
    },
    refund: {
      deleteMany: mocks.refundDeleteMany,
    },
    workflowInstance: {
      deleteMany: mocks.workflowInstanceDeleteMany,
      findMany: mocks.workflowInstanceFindMany,
    },
    workflowLog: {
      deleteMany: mocks.workflowLogDeleteMany,
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

describe("POST /api/demo/reset", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("customer 不能重置演示数据", async () => {
    mocks.requireStaff.mockRejectedValue(new mocks.PermissionDeniedError());

    const response = await POST();

    expect(response.status).toBe(403);
    expect(mocks.orderFindMany).not.toHaveBeenCalled();
    expect(mocks.orderDeleteMany).not.toHaveBeenCalled();
  });
});
