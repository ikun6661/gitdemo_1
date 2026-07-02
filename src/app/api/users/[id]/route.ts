import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { forbidden } from "@/server/shared/api";

export async function PUT(req: NextRequest, ctx: RouteContext<"/api/users/[id]">) {
  const session = await auth();
  if (!session || session.user.role !== "admin") {
    return forbidden();
  }
  const { id } = await ctx.params;
  const { role } = await req.json();
  const user = await prisma.user.update({ where: { id }, data: { role } });
  return NextResponse.json(user);
}
