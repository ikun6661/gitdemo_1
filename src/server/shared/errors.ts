import { ZodError } from "zod";

export function getErrorMessage(error: unknown): string {
  if (error instanceof ZodError) {
    return error.issues.map((issue) => issue.message).join("；");
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "系统处理失败";
}
