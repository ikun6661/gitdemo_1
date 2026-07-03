import { NextRequest, NextResponse } from "next/server";
import {
  AuthRequiredError,
  PermissionDeniedError,
  requireStaff,
} from "@/server/auth/guards";
import { errorResponse, notFound } from "@/server/shared/api";
import { getInstance } from "@/server/workflow/engine";

export async function GET(
  req: NextRequest,
  ctx: RouteContext<"/api/workflows/instances/[id]">
) {
  try {
    await requireStaff();
    const { id } = await ctx.params;
    const instance = await getInstance(id);
    return NextResponse.json(instance);
  } catch (error: unknown) {
    if (
      error instanceof AuthRequiredError ||
      error instanceof PermissionDeniedError
    ) {
      return errorResponse(error);
    }

    return notFound(error);
  }
}
