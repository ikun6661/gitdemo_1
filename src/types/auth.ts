import {
  canAccessAdmin,
  type UserRole,
} from "@/server/domain/constants";

export type { UserRole };

export interface AuthUser {
  id: string;
  name?: string | null;
  email?: string | null;
  role: UserRole;
}

export function isStaffRole(role: UserRole | undefined): boolean {
  return canAccessAdmin(role);
}
