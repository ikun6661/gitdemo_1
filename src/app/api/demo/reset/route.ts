import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST() {
  const demoOrders = await prisma.order.findMany({ where: { orderNo: { startsWith: "DEMO-" } }, select: { id: true } });
  const demoOrderIds = demoOrders.map((o) => o.id);
  const instances = await prisma.workflowInstance.findMany({ where: { targetType: "order", targetId: { in: demoOrderIds } }, select: { id: true } });
  const instanceIds = instances.map((i) => i.id);

  await prisma.workflowLog.deleteMany({ where: { instanceId: { in: instanceIds } } });
  await prisma.workflowInstance.deleteMany({ where: { id: { in: instanceIds } } });
  await prisma.refund.deleteMany({ where: { orderId: { in: demoOrderIds } } });
  await prisma.orderItem.deleteMany({ where: { orderId: { in: demoOrderIds } } });
  await prisma.order.deleteMany({ where: { id: { in: demoOrderIds } } });

  return NextResponse.json({ success: true, deletedOrders: demoOrderIds.length });
}
