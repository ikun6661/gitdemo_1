import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/server/auth/guards";
import { canAccessAdmin } from "@/server/domain/constants";
import { createInstance } from "@/server/workflow/engine";
import { errorResponse, notFound } from "@/server/shared/api";

// 获取退款列表
export async function GET() {
  try {
    const user = await requireAuth();

    const refunds = await prisma.refund.findMany({
      where: canAccessAdmin(user.role) ? undefined : { userId: user.id },
      include: {
        order: true,
        user: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return NextResponse.json(refunds);
  } catch (error: unknown) {
    return errorResponse(error);
  }
}

// 申请退款
export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth();

    const { orderId, reason, amount } = await req.json();

    // 校验订单是否存在
    const order = await prisma.order.findFirst({
      where:
        canAccessAdmin(user.role)
          ? { id: orderId }
          : { id: orderId, userId: user.id },
    });
    if (!order) return notFound(new Error("订单不存在"));

    // 创建退款单
    const refund = await prisma.refund.create({
      data: {
        orderId,
        userId: order.userId,
        reason,
        amount: amount ?? order.totalAmount,
      },
    });

    // 启动退款审批工作流
    await createInstance({
      workflowType: "refund_approval",
      targetType: "refund",
      targetId: refund.id,
      context: {
        orderNo: order.orderNo,
        reason,
        amount: refund.amount,
        operator: user.name ?? undefined,
      },
    });

    return NextResponse.json(refund, { status: 201 });
  } catch (error: unknown) {
    return errorResponse(error);
  }
}
