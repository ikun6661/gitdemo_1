import { describe, expect, it } from "vitest";
import {
  canAccessAdmin,
  getDefaultRedirectForRole,
  isUserRole,
} from "@/server/domain/constants";

describe("auth role helpers", () => {
  it("detects valid user roles", () => {
    expect(isUserRole("admin")).toBe(true);
    expect(isUserRole("operator")).toBe(true);
    expect(isUserRole("customer")).toBe(true);
  });

  it("rejects invalid user role strings", () => {
    expect(isUserRole("guest")).toBe(false);
    expect(isUserRole("")).toBe(false);
  });

  it("allows admin and operator to access admin surfaces", () => {
    expect(canAccessAdmin("admin")).toBe(true);
    expect(canAccessAdmin("operator")).toBe(true);
  });

  it("does not allow customers to access admin surfaces", () => {
    expect(canAccessAdmin("customer")).toBe(false);
    expect(canAccessAdmin(undefined)).toBe(false);
  });

  it("chooses default redirect by role", () => {
    expect(getDefaultRedirectForRole("customer")).toBe("/products");
    expect(getDefaultRedirectForRole("operator")).toBe("/dashboard");
    expect(getDefaultRedirectForRole("admin")).toBe("/dashboard");
  });
});
