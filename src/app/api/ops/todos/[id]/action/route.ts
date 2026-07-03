import { type NextRequest, NextResponse } from "next/server";
import {
  AuthRequiredError,
  PermissionDeniedError,
  requireStaff,
} from "@/server/auth/guards";
import { performOpsTodoAction } from "@/server/operations/todos";
import { badRequest, errorResponse } from "@/server/shared/api";

type RouteParamsContext = {
  params: Promise<{ id: string }>;
};

const businessErrorMessages = new Set([
  "待办 ID 无效",
  "待办不存在",
  "待办已处理",
  "订单动作无效",
  "退款动作无效",
  "退款单不存在",
  "商品动作无效",
  "商品待办不存在",
]);

function isBusinessError(error: unknown): error is Error {
  return error instanceof Error && businessErrorMessages.has(error.message);
}

export async function POST(req: NextRequest, ctx: RouteParamsContext) {
  try {
    const user = await requireStaff();
    const { id } = await ctx.params;
    let body: unknown;

    try {
      body = await req.json();
    } catch {
      return badRequest(new Error("JSON body 无效"));
    }

    if (
      typeof body !== "object" ||
      body === null ||
      !("action" in body) ||
      typeof body.action !== "string" ||
      body.action.length === 0
    ) {
      return badRequest(new Error("动作不能为空"));
    }

    const comment = "comment" in body && typeof body.comment === "string"
      ? body.comment
      : "";
    const result = await performOpsTodoAction({
      todoId: id,
      action: body.action,
      comment,
      operator: user.name ?? "unknown",
    });

    return NextResponse.json(result);
  } catch (error: unknown) {
    if (
      error instanceof AuthRequiredError ||
      error instanceof PermissionDeniedError
    ) {
      return errorResponse(error);
    }

    if (isBusinessError(error)) {
      return badRequest(error);
    }

    return errorResponse(error);
  }
}
