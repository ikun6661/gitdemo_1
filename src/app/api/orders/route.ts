import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { createInstance } from "@/server/workflow/engine";
import { badRequest, unauthorized } from "@/server/shared/api";

// 生成订单号
function generateOrderNo(): string {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, "");
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `ORD-${date}-${rand}`;
}

// 获取订单列表（客户只能看自己的；管理员看全部）
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return unauthorized();

  const { searchParams } = new URL(req.url);
  const userId = session.user.id;
  const role = session.user.role;

  const where: Record<string, unknown> = {};
  if (role === "customer") where.userId = userId;

  const status = searchParams.get("status");
  if (status) where.status = status;

  const orders = await prisma.order.findMany({
    where,
    include: { items: { include: { product: true } } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json(orders);
}

// 创建订单（从购物车结算）
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return unauthorized();

  const userId = session.user.id;
  const body = await req.json();
  const { address, cartItemIds } = body;

  if (!cartItemIds || cartItemIds.length === 0) {
    return NextResponse.json({ error: "购物车为空" }, { status: 400 });
  }

  // 查询购物车项目
  const cartItems = await prisma.cartItem.findMany({
    where: { id: { in: cartItemIds }, userId },
    include: { product: true },
  });

  if (cartItems.length === 0) {
    return NextResponse.json({ error: "购物车项目无效" }, { status: 400 });
  }

  // 计算总金额并校验库存
  let totalAmount = 0;
  const orderItems: {
    productId: string;
    quantity: number;
    unitPrice: number;
    snapshot: {
      name: string;
      price: number;
      images: string;
    };
  }[] = [];

  for (const item of cartItems) {
    if (item.product.stock < item.quantity) {
      return badRequest(new Error(`${item.product.name} 库存不足`));
    }
    totalAmount += item.product.price * item.quantity;
    orderItems.push({
      productId: item.product.id,
      quantity: item.quantity,
      unitPrice: item.product.price,
      snapshot: {
        name: item.product.name,
        price: item.product.price,
        images: item.product.images,
      },
    });
  }

  const orderNo = generateOrderNo();

  // 事务：创建订单 + 扣库存 + 清空购物车对应项
  const order = await prisma.$transaction(async (tx) => {
    const o = await tx.order.create({
      data: {
        orderNo,
        userId,
        totalAmount,
        address: JSON.stringify(address ?? {}),
        status: "pending_payment",
        items: {
          create: orderItems.map((i) => ({
            productId: i.productId,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
            snapshot: JSON.stringify(i.snapshot),
          })),
        },
      },
    });

    // 扣减库存
    for (const item of orderItems) {
      await tx.product.update({
        where: { id: item.productId },
        data: { stock: { decrement: item.quantity } },
      });
    }

    // 清空购物车中已下单的商品
    await tx.cartItem.deleteMany({
      where: { id: { in: cartItemIds } },
    });

    return o;
  });

  // 启动订单工作流
  await createInstance({
    workflowType: "order_flow",
    targetType: "order",
    targetId: order.id,
    context: {
      orderNo,
      amount: totalAmount,
      operator: session.user?.name ?? undefined,
    },
  });

  return NextResponse.json(order, { status: 201 });
}
