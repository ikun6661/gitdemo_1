export type UserRole = "admin" | "operator" | "customer";

export interface AuthUser {
  id: string;
  name?: string | null;
  email?: string | null;
  role: UserRole;
}

export function isStaffRole(role: UserRole | undefined): boolean {
  return role === "admin" || role === "operator";
}
