import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { createInstance } from "@/server/workflow/engine";

// 获取退款列表
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const refunds = await prisma.refund.findMany({
    include: {
      order: true,
      user: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json(refunds);
}

// 申请退款
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const userId = (session.user as any).id;
  const { orderId, reason, amount } = await req.json();

  // 校验订单是否存在
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) return NextResponse.json({ error: "订单不存在" }, { status: 404 });

  // 创建退款单
  const refund = await prisma.refund.create({
    data: {
      orderId,
      userId,
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
      operator: session.user?.name,
    },
  });

  return NextResponse.json(refund, { status: 201 });
}
