import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  PermissionDeniedError,
  requireAuth,
} from "@/server/auth/guards";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  auth: mocks.auth,
}));

describe("requireAuth runtime role validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("非法角色会拒绝访问", async () => {
    mocks.auth.mockResolvedValue({
      user: {
        id: "user-1",
        name: "User",
        email: "user@example.com",
        role: "guest",
      },
    });

    await expect(requireAuth()).rejects.toBeInstanceOf(PermissionDeniedError);
  });

  it("合法角色会正常返回用户", async () => {
    mocks.auth.mockResolvedValue({
      user: {
        id: "user-1",
        name: "User",
        email: "user@example.com",
        role: "operator",
      },
    });

    await expect(requireAuth()).resolves.toEqual({
      id: "user-1",
      name: "User",
      email: "user@example.com",
      role: "operator",
    });
  });
});
