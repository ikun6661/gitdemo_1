import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";

const mocks = vi.hoisted(() => ({
  AuthRequiredError: class MockAuthRequiredError extends Error {},
  getInstance: vi.fn(),
  PermissionDeniedError: class MockPermissionDeniedError extends Error {},
  requireStaff: vi.fn(),
  transition: vi.fn(),
}));

vi.mock("@/server/auth/guards", () => {
  return {
    AuthRequiredError: mocks.AuthRequiredError,
    PermissionDeniedError: mocks.PermissionDeniedError,
    requireStaff: mocks.requireStaff,
  };
});

vi.mock("@/server/workflow/engine", () => ({
  getInstance: mocks.getInstance,
  transition: mocks.transition,
}));

describe("POST /api/demo/step", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("未登录不能推进演示步骤", async () => {
    mocks.requireStaff.mockRejectedValue(new mocks.AuthRequiredError());

    const response = await POST(
      new NextRequest("http://test.local/api/demo/step", {
        method: "POST",
        body: JSON.stringify({
          instanceId: "instance-1",
          scenario: "order_flow",
          stepIndex: 0,
        }),
      })
    );

    expect(response.status).toBe(401);
    expect(mocks.transition).not.toHaveBeenCalled();
  });

  it("customer 不能推进演示步骤", async () => {
    mocks.requireStaff.mockRejectedValue(new mocks.PermissionDeniedError());

    const response = await POST(
      new NextRequest("http://test.local/api/demo/step", {
        method: "POST",
        body: JSON.stringify({
          instanceId: "instance-1",
          scenario: "order_flow",
          stepIndex: 0,
        }),
      })
    );

    expect(response.status).toBe(403);
    expect(mocks.transition).not.toHaveBeenCalled();
  });

  it("使用登录员工名称作为 operator", async () => {
    mocks.requireStaff.mockResolvedValue({
      id: "operator-1",
      name: "Operator",
      email: "operator@example.com",
      role: "operator",
    });
    mocks.transition.mockResolvedValue({ isEnd: false });
    mocks.getInstance.mockResolvedValue({
      currentNode: "paid",
      workflow: { nodes: [{ key: "paid", label: "已支付" }] },
    });

    const response = await POST(
      new NextRequest("http://test.local/api/demo/step", {
        method: "POST",
        body: JSON.stringify({
          instanceId: "instance-1",
          scenario: "order_flow",
          stepIndex: 0,
        }),
      })
    );

    expect(response.status).toBe(200);
    expect(mocks.transition).toHaveBeenCalledWith(
      expect.objectContaining({ operator: "Operator" })
    );
  });
});
