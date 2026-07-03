import { NextRequest, NextResponse } from "next/server";
import {
  AuthRequiredError,
  PermissionDeniedError,
  requireStaff,
} from "@/server/auth/guards";
import { badRequest, errorResponse } from "@/server/shared/api";
import { transition } from "@/server/workflow/engine";

export async function POST(
  req: NextRequest,
  ctx: RouteContext<"/api/workflows/instances/[id]/transition">
) {
  try {
    const user = await requireStaff();
    const { id } = await ctx.params;
    const body = await req.json();
    const result = await transition({
      instanceId: id,
      trigger: body.trigger,
      operator: user.name ?? "unknown",
      comment: body.comment ?? "",
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
