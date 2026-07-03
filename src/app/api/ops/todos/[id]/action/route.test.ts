import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";

const mocks = vi.hoisted(() => ({
  AuthRequiredError: class MockAuthRequiredError extends Error {},
  PermissionDeniedError: class MockPermissionDeniedError extends Error {},
  performOpsTodoAction: vi.fn(),
  requireStaff: vi.fn(),
}));

vi.mock("@/server/auth/guards", () => ({
  AuthRequiredError: mocks.AuthRequiredError,
  PermissionDeniedError: mocks.PermissionDeniedError,
  requireStaff: mocks.requireStaff,
}));

vi.mock("@/server/operations/todos", () => ({
  performOpsTodoAction: mocks.performOpsTodoAction,
}));

describe("POST /api/ops/todos/[id]/action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireStaff.mockResolvedValue({
      id: "operator-1",
      name: "王运营",
      email: "operator@example.com",
      role: "operator",
    });
    mocks.performOpsTodoAction.mockResolvedValue({ success: true });
  });

  it("staff 请求有效 action 时委托给 performOpsTodoAction 并返回 200", async () => {
    const response = await POST(
      new NextRequest("http://test.local/api/ops/todos/order:todo-1/action", {
        method: "POST",
        body: JSON.stringify({ action: "ship", comment: "仓库已确认" }),
      }),
      { params: Promise.resolve({ id: "order:todo-1" }) },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ success: true });
    expect(mocks.requireStaff).toHaveBeenCalledTimes(1);
    expect(mocks.performOpsTodoAction).toHaveBeenCalledWith({
      todoId: "order:todo-1",
      action: "ship",
      comment: "仓库已确认",
      operator: "王运营",
    });
  });

  it("action 缺失返回 400 且不调用 service", async () => {
    const response = await POST(
      new NextRequest("http://test.local/api/ops/todos/order:todo-1/action", {
        method: "POST",
        body: JSON.stringify({ comment: "仓库已确认" }),
      }),
      { params: Promise.resolve({ id: "order:todo-1" }) },
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ error: "动作不能为空" });
    expect(mocks.performOpsTodoAction).not.toHaveBeenCalled();
  });

  it("JSON body 无效时返回 400 且不调用 service", async () => {
    const response = await POST(
      new NextRequest("http://test.local/api/ops/todos/order:todo-1/action", {
        method: "POST",
        body: "{",
      }),
      { params: Promise.resolve({ id: "order:todo-1" }) },
    );

    expect(response.status).toBe(400);
    expect(mocks.performOpsTodoAction).not.toHaveBeenCalled();
  });

  it("非 staff 返回 403 且不调用 service", async () => {
    mocks.requireStaff.mockRejectedValue(new mocks.PermissionDeniedError());

    const response = await POST(
      new NextRequest("http://test.local/api/ops/todos/order:todo-1/action", {
        method: "POST",
        body: JSON.stringify({ action: "ship" }),
      }),
      { params: Promise.resolve({ id: "order:todo-1" }) },
    );

    expect(response.status).toBe(403);
    expect(mocks.requireStaff).toHaveBeenCalledTimes(1);
    expect(mocks.performOpsTodoAction).not.toHaveBeenCalled();
  });

  it("performOpsTodoAction 抛业务 Error 时返回 400", async () => {
    mocks.performOpsTodoAction.mockRejectedValue(new Error("订单动作无效"));

    const response = await POST(
      new NextRequest("http://test.local/api/ops/todos/order:todo-1/action", {
        method: "POST",
        body: JSON.stringify({ action: "invalid", comment: 123 }),
      }),
      { params: Promise.resolve({ id: "order:todo-1" }) },
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ error: "订单动作无效" });
    expect(mocks.performOpsTodoAction).toHaveBeenCalledWith({
      todoId: "order:todo-1",
      action: "invalid",
      comment: "",
      operator: "王运营",
    });
  });

  it("performOpsTodoAction 抛未知系统错误时返回 500 且不泄露内部消息", async () => {
    mocks.performOpsTodoAction.mockRejectedValue(
      new Error("database password leaked"),
    );

    const response = await POST(
      new NextRequest("http://test.local/api/ops/todos/order:todo-1/action", {
        method: "POST",
        body: JSON.stringify({ action: "ship" }),
      }),
      { params: Promise.resolve({ id: "order:todo-1" }) },
    );
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(JSON.stringify(body)).not.toContain("database password leaked");
  });
});
