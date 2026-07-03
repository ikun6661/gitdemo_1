import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  AuthRequiredError: class MockAuthRequiredError extends Error {},
  PermissionDeniedError: class MockPermissionDeniedError extends Error {},
  listInstances: vi.fn(),
  requireStaff: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  auth: mocks.auth,
}));

vi.mock("@/server/auth/guards", () => {
  return {
    AuthRequiredError: mocks.AuthRequiredError,
    PermissionDeniedError: mocks.PermissionDeniedError,
    requireStaff: mocks.requireStaff,
  };
});

vi.mock("@/server/workflow/engine", () => ({
  listInstances: mocks.listInstances,
}));

describe("GET /api/workflows/instances", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listInstances.mockResolvedValue([]);
  });

  it("customer 不能读取 workflow 列表", async () => {
    mocks.auth.mockResolvedValue({
      user: {
        id: "customer-1",
        name: "Customer",
        email: "customer@example.com",
        role: "customer",
      },
    });
    mocks.requireStaff.mockRejectedValue(new mocks.PermissionDeniedError());

    const response = await GET(
      new NextRequest("http://test.local/api/workflows/instances")
    );

    expect(response.status).toBe(403);
    expect(mocks.requireStaff).toHaveBeenCalledTimes(1);
    expect(mocks.listInstances).not.toHaveBeenCalled();
  });
});
