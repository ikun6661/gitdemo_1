import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { forbidden } from "@/server/shared/api";

export async function GET() {
  const session = await auth();
  if (!session || session.user.role !== "admin") {
    return forbidden();
  }
  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(users);
}
