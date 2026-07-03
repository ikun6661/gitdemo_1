import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  AuthRequiredError: class MockAuthRequiredError extends Error {},
  PermissionDeniedError: class MockPermissionDeniedError extends Error {},
  requireStaff: vi.fn(),
  transition: vi.fn(),
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
  transition: mocks.transition,
}));

describe("POST /api/workflows/instances/[id]/transition", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.transition.mockResolvedValue({});
  });

  it("customer 不能推进 workflow", async () => {
    mocks.auth.mockResolvedValue({
      user: {
        id: "customer-1",
        name: "Customer",
        email: "customer@example.com",
        role: "customer",
      },
    });
    mocks.requireStaff.mockRejectedValue(new mocks.PermissionDeniedError());

    const response = await POST(
      new NextRequest(
        "http://test.local/api/workflows/instances/instance-1/transition",
        {
          method: "POST",
          body: JSON.stringify({ trigger: "approve" }),
        }
      ),
      { params: Promise.resolve({ id: "instance-1" }) }
    );

    expect(response.status).toBe(403);
    expect(mocks.requireStaff).toHaveBeenCalledTimes(1);
    expect(mocks.transition).not.toHaveBeenCalled();
  });
});
