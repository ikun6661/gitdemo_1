import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { createInstance } from "@/server/workflow/engine";

const SCENARIOS: Record<string, { name: string; description: string; steps: { trigger: string; label: string; detail: string }[] }> = {
  order_flow: {
    name: "标准订单流程",
    description: "从用户下单到收货完成的完整订单链路",
    steps: [
      { trigger: "pay", label: "用户支付订单", detail: "用户通过微信/支付宝完成付款，系统自动确认收款" },
      { trigger: "ship", label: "商家确认发货", detail: "仓库拣货完成，物流单号已录入，商品已发出" },
      { trigger: "receive", label: "用户确认收货", detail: "物流显示已签收，用户点击确认收货" },
      { trigger: "complete", label: "订单完成", detail: "订单状态变为已完成，交易成功" },
    ],
  },
  refund_approval: {
    name: "退款审批流程",
    description: "用户申请退款后的内部审批流转",
    steps: [
      { trigger: "submit", label: "提交客服审核", detail: "退款申请已提交，等待客服审核材料" },
      { trigger: "cs_approve", label: "客服审核通过", detail: "客服确认退款原因合理，提交经理审批" },
      { trigger: "manager_approve", label: "经理审批通过", detail: "经理批准退款，款项将退回用户账户" },
    ],
  },
  product_approval: {
    name: "商品上架审批",
    description: "运营提交商品到上架的全流程",
    steps: [
      { trigger: "submit", label: "提交审核", detail: "商品信息已完善，提交管理员审核" },
      { trigger: "approve", label: "审核通过上架", detail: "管理员审核通过，商品在前端商城可见" },
    ],
  },
};

export async function GET() {
  return NextResponse.json(SCENARIOS);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "未登录" }, { status: 401 });
  await req.json();

  const product = await prisma.product.findFirst({ where: { status: "published" } });
  const customer = await prisma.user.findFirst({ where: { email: "customer@ecomflow.com" } });
  if (!product || !customer) return NextResponse.json({ error: "演示数据未就绪" }, { status: 500 });

  const order = await prisma.order.create({
    data: {
      orderNo: `DEMO-${Date.now().toString(36).toUpperCase()}`,
      userId: customer.id, totalAmount: product.price,
      address: JSON.stringify({ name: "演示客户", phone: "13800138000", address: "北京市朝阳区演示路1号" }),
      status: "pending_payment",
      items: { create: [{ productId: product.id, quantity: 1, unitPrice: product.price, snapshot: JSON.stringify({ name: product.name, price: product.price }) }] },
    },
  });

  const instance = await createInstance({
    workflowType: "order_flow", targetType: "order", targetId: order.id,
    context: {
      orderNo: order.orderNo,
      amount: order.totalAmount,
      demo: true,
      operator: session.user?.name ?? undefined,
    },
  });

  return NextResponse.json({ instance, order, stepIndex: 0 });
}
