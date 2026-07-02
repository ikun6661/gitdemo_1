import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/server/auth/guards";
import { canAccessAdmin } from "@/server/domain/constants";
import { errorResponse } from "@/server/shared/api";

// 获取订单详情（含工作流实例）
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();

    const { id } = await params;
    const order = await prisma.order.findFirst({
      where:
        canAccessAdmin(user.role) ? { id } : { id, userId: user.id },
      include: {
        items: { include: { product: true } },
        user: { select: { name: true, email: true } },
      },
    });

    if (!order) return NextResponse.json({ error: "订单不存在" }, { status: 404 });

    const workflowInstances = await prisma.workflowInstance.findMany({
      where: {
        targetType: "order",
        targetId: id,
      },
      include: {
        workflow: true,
        logs: { orderBy: { createdAt: "asc" } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ ...order, workflowInstances });
  } catch (error: unknown) {
    return errorResponse(error);
  }
}
