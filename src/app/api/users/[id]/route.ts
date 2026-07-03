import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, parseUserRole } from "@/server/auth/guards";
import { badRequest, errorResponse } from "@/server/shared/api";

export async function PUT(req: NextRequest, ctx: RouteContext<"/api/users/[id]">) {
  try {
    await requireAdmin();
    const { id } = await ctx.params;
    const { role } = await req.json();
    const nextRole = parseUserRole(role);
    if (!nextRole) {
      return badRequest(new Error("角色无效"));
    }
    const user = await prisma.user.update({
      where: { id },
      data: { role: nextRole },
    });
    return NextResponse.json(user);
  } catch (error: unknown) {
    return errorResponse(error);
  }
}
