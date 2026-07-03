export const USER_ROLES = ["admin", "operator", "customer"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const PRODUCT_STATUSES = [
  "draft",
  "pending",
  "published",
  "rejected",
] as const;
export type ProductStatus = (typeof PRODUCT_STATUSES)[number];

export const ORDER_STATUSES = [
  "pending_payment",
  "paid",
  "shipped",
  "received",
  "completed",
  "cancelled",
  "refunding",
  "refunded",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const PAYMENT_STATUSES = [
  "pending",
  "succeeded",
  "failed",
  "cancelled",
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export function isUserRole(role: string): role is UserRole {
  return USER_ROLES.includes(role as UserRole);
}

export function canAccessAdmin(role: UserRole | undefined): boolean {
  return role === "admin" || role === "operator";
}

export function getDefaultRedirectForRole(role: UserRole): string {
  return canAccessAdmin(role) ? "/dashboard" : "/products";
}
