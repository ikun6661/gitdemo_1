import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";

const mocks = vi.hoisted(() => ({
  AuthRequiredError: class MockAuthRequiredError extends Error {},
  getInstance: vi.fn(),
  PermissionDeniedError: class MockPermissionDeniedError extends Error {},
  requireStaff: vi.fn(),
}));

vi.mock("@/server/auth/guards", () => ({
  AuthRequiredError: mocks.AuthRequiredError,
  PermissionDeniedError: mocks.PermissionDeniedError,
  requireStaff: mocks.requireStaff,
}));

vi.mock("@/server/workflow/engine", () => ({
  getInstance: mocks.getInstance,
}));

describe("GET /api/workflows/instances/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("customer 不能读取 workflow 详情", async () => {
    mocks.requireStaff.mockRejectedValue(new mocks.PermissionDeniedError());

    const response = await GET(
      new NextRequest("http://test.local/api/workflows/instances/instance-1"),
      { params: Promise.resolve({ id: "instance-1" }) }
    );

    expect(response.status).toBe(403);
    expect(mocks.getInstance).not.toHaveBeenCalled();
  });
});
