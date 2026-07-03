import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  AuthRequiredError,
  PermissionDeniedError,
  requireAuth,
  requireStaff,
} from "@/server/auth/guards";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  userFindUnique: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  auth: mocks.auth,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: mocks.userFindUnique,
    },
  },
}));

describe("requireAuth runtime role validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("缺少 session user id 时要求登录", async () => {
    mocks.auth.mockResolvedValue({
      user: {
        name: "User",
        email: "user@example.com",
        role: "operator",
      },
    });

    await expect(requireAuth()).rejects.toBeInstanceOf(AuthRequiredError);
    expect(mocks.userFindUnique).not.toHaveBeenCalled();
  });

  it("数据库用户不存在时拒绝访问", async () => {
    mocks.auth.mockResolvedValue({
      user: {
        id: "user-1",
        name: "User",
        email: "user@example.com",
        role: "operator",
      },
    });
    mocks.userFindUnique.mockResolvedValue(null);

    await expect(requireAuth()).rejects.toBeInstanceOf(PermissionDeniedError);
  });

  it("数据库非法角色会拒绝访问", async () => {
    mocks.auth.mockResolvedValue({
      user: {
        id: "user-1",
        name: "User",
        email: "user@example.com",
        role: "operator",
      },
    });
    mocks.userFindUnique.mockResolvedValue({
      id: "user-1",
      name: "User",
      email: "user@example.com",
      role: "guest",
    });

    await expect(requireAuth()).rejects.toBeInstanceOf(PermissionDeniedError);
  });

  it("返回数据库中的当前角色", async () => {
    mocks.auth.mockResolvedValue({
      user: {
        id: "user-1",
        name: "Stale User",
        email: "stale@example.com",
        role: "operator",
      },
    });
    mocks.userFindUnique.mockResolvedValue({
      id: "user-1",
      name: "Current User",
      email: "current@example.com",
      role: "customer",
    });

    await expect(requireAuth()).resolves.toEqual({
      id: "user-1",
      name: "Current User",
      email: "current@example.com",
      role: "customer",
    });
    expect(mocks.userFindUnique).toHaveBeenCalledWith({
      where: { id: "user-1" },
      select: { id: true, name: true, email: true, role: true },
    });
  });

  it("session token 是 operator 但数据库角色已是 customer 时 requireStaff 拒绝访问", async () => {
    mocks.auth.mockResolvedValue({
      user: {
        id: "user-1",
        name: "User",
        email: "user@example.com",
        role: "operator",
      },
    });
    mocks.userFindUnique.mockResolvedValue({
      id: "user-1",
      name: "User",
      email: "user@example.com",
      role: "customer",
    });

    await expect(requireStaff()).rejects.toBeInstanceOf(PermissionDeniedError);
  });

  it("数据库角色是 operator 时 requireStaff 允许访问", async () => {
    mocks.auth.mockResolvedValue({
      user: {
        id: "user-1",
        name: "User",
        email: "user@example.com",
        role: "customer",
      },
    });
    mocks.userFindUnique.mockResolvedValue({
      id: "user-1",
      name: "User",
      email: "user@example.com",
      role: "operator",
    });

    await expect(requireStaff()).resolves.toEqual({
      id: "user-1",
      name: "User",
      email: "user@example.com",
      role: "operator",
    });
  });
});
