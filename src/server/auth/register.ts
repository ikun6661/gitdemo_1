export interface RegisterInput {
  name: string;
  email: string;
  password: string;
}

export type RegisterValidationResult =
  | { ok: true; data: RegisterInput }
  | { ok: false; error: string };

export function validateRegisterInput(
  input: RegisterInput,
): RegisterValidationResult {
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  const password = input.password;

  if (!name) {
    return { ok: false, error: "请输入姓名" };
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "请输入正确的邮箱" };
  }

  if (password.length < 6) {
    return { ok: false, error: "密码至少需要 6 位" };
  }

  return {
    ok: true,
    data: { name, email, password },
  };
}
