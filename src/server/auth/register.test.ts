import { describe, expect, it } from "vitest";
import { validateRegisterInput } from "./register";

describe("validateRegisterInput", () => {
  it("rejects an empty name", () => {
    const result = validateRegisterInput({
      name: "",
      email: "customer@example.com",
      password: "demo123456",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("请输入姓名");
    }
  });

  it("rejects invalid email", () => {
    const result = validateRegisterInput({
      name: "演示用户",
      email: "not-email",
      password: "demo123456",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("请输入正确的邮箱");
    }
  });

  it("rejects short password", () => {
    const result = validateRegisterInput({
      name: "演示用户",
      email: "customer@example.com",
      password: "123",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("密码至少需要 6 位");
    }
  });

  it("accepts valid input and normalizes email", () => {
    const result = validateRegisterInput({
      name: " 演示用户 ",
      email: " CUSTOMER@Example.COM ",
      password: "demo123456",
    });

    expect(result).toEqual({
      ok: true,
      data: {
        name: "演示用户",
        email: "customer@example.com",
        password: "demo123456",
      },
    });
  });
});
