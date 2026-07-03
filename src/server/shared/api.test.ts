import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { errorResponse } from "./api";

const mocks = vi.hoisted(() => ({
  AuthRequiredError: class MockAuthRequiredError extends Error {},
  PermissionDeniedError: class MockPermissionDeniedError extends Error {},
}));

vi.mock("@/server/auth/guards", () => ({
  AuthRequiredError: mocks.AuthRequiredError,
  PermissionDeniedError: mocks.PermissionDeniedError,
}));

describe("errorResponse", () => {
  it("ZodError 映射为 400", async () => {
    const result = z.string().safeParse(123);

    if (result.success) {
      throw new Error("测试输入应触发 ZodError");
    }

    const response = errorResponse(result.error);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain("Invalid input");
  });

  it("普通 Error 映射为 500 且不暴露内部信息", async () => {
    const response = errorResponse(new Error("database password leaked"));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({ error: "服务器错误" });
  });
});
