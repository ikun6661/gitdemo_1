import { NextRequest, NextResponse } from "next/server";
import { getInstance } from "@/server/workflow/engine";
import { auth } from "@/lib/auth";
import { notFound, unauthorized } from "@/server/shared/api";

export async function GET(req: NextRequest, ctx: RouteContext<"/api/workflows/instances/[id]">) {
  const session = await auth();
  if (!session) return unauthorized();
  try {
    const { id } = await ctx.params;
    const instance = await getInstance(id);
    return NextResponse.json(instance);
  } catch (error: unknown) {
    return notFound(error);
  }
}
