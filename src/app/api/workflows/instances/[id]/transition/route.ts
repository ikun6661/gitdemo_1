import { NextRequest, NextResponse } from "next/server";
import { transition } from "@/server/workflow/engine";
import { auth } from "@/lib/auth";
import { badRequest, unauthorized } from "@/server/shared/api";

export async function POST(req: NextRequest, ctx: RouteContext<"/api/workflows/instances/[id]/transition">) {
  const session = await auth();
  if (!session) return unauthorized();
  try {
    const { id } = await ctx.params;
    const body = await req.json();
    const result = await transition({
      instanceId: id,
      trigger: body.trigger,
      operator: session.user?.name ?? "unknown",
      comment: body.comment ?? "",
    });
    return NextResponse.json(result);
  } catch (error: unknown) {
    return badRequest(error);
  }
}
