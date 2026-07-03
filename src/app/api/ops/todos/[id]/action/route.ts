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

export async function POST(req: NextRequest, ctx: RouteParamsContext) {
  try {
    const user = await requireStaff();
    const { id } = await ctx.params;
    const body: unknown = await req.json();

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

    return badRequest(error);
  }
}
