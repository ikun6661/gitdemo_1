import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  canAccessAdmin,
  isUserRole,
  type UserRole,
} from "@/server/domain/constants";
import type { AuthUser } from "@/types/auth";

export class AuthRequiredError extends Error {
  constructor() {
    super("未登录");
    this.name = "AuthRequiredError";
  }
}

export class PermissionDeniedError extends Error {
  constructor() {
    super("无权限");
    this.name = "PermissionDeniedError";
  }
}

export async function requireAuth(): Promise<AuthUser> {
  const session = await auth();

  if (!session?.user?.id) {
    throw new AuthRequiredError();
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, email: true, role: true },
  });

  if (!user || !isUserRole(user.role)) {
    throw new PermissionDeniedError();
  }

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  };
}

export async function requireStaff(): Promise<AuthUser> {
  const user = await requireAuth();

  if (!canAccessAdmin(user.role)) {
    throw new PermissionDeniedError();
  }

  return user;
}

export async function requireAdmin(): Promise<AuthUser> {
  const user = await requireAuth();

  if (user.role !== "admin") {
    throw new PermissionDeniedError();
  }

  return user;
}

export function parseUserRole(role: unknown): UserRole | null {
  if (typeof role !== "string" || !isUserRole(role)) {
    return null;
  }

  return role;
}
