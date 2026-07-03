import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";

const mocks = vi.hoisted(() => ({
  AuthRequiredError: class MockAuthRequiredError extends Error {},
  PermissionDeniedError: class MockPermissionDeniedError extends Error {},
  listOpsTodos: vi.fn(),
  requireStaff: vi.fn(),
}));

vi.mock("@/server/auth/guards", () => ({
  AuthRequiredError: mocks.AuthRequiredError,
  PermissionDeniedError: mocks.PermissionDeniedError,
  requireStaff: mocks.requireStaff,
}));

vi.mock("@/server/operations/todos", () => ({
  listOpsTodos: mocks.listOpsTodos,
}));

describe("GET /api/ops/todos", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireStaff.mockResolvedValue({
      id: "operator-1",
      name: "Operator",
      email: "operator@example.com",
      role: "operator",
    });
    mocks.listOpsTodos.mockResolvedValue({ summary: { total: 0 }, todos: [] });
  });

  it("staff 请求带筛选条件时委托给 listOpsTodos 并返回 200", async () => {
    const response = await GET(
      new NextRequest(
        "http://test.local/api/ops/todos?type=order&status=paid&search=ORD",
      ),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ summary: { total: 0 }, todos: [] });
    expect(mocks.requireStaff).toHaveBeenCalledTimes(1);
    expect(mocks.listOpsTodos).toHaveBeenCalledWith({
      type: "order",
      status: "paid",
      search: "ORD",
    });
  });

  it("非 staff 返回 403 且不调用 listOpsTodos", async () => {
    mocks.requireStaff.mockRejectedValue(new mocks.PermissionDeniedError());

    const response = await GET(
      new NextRequest("http://test.local/api/ops/todos"),
    );

    expect(response.status).toBe(403);
    expect(mocks.requireStaff).toHaveBeenCalledTimes(1);
    expect(mocks.listOpsTodos).not.toHaveBeenCalled();
  });

  it("非法 type 会被忽略", async () => {
    const response = await GET(
      new NextRequest("http://test.local/api/ops/todos?type=bad"),
    );

    expect(response.status).toBe(200);
    expect(mocks.listOpsTodos).toHaveBeenCalledWith({
      type: undefined,
      status: undefined,
      search: undefined,
    });
  });
});
