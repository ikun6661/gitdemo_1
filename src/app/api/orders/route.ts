import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/server/auth/guards";
import { badRequest, errorResponse } from "@/server/shared/api";
import { createInstance } from "@/server/workflow/engine";

function generateOrderNo(): string {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, "");
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `ORD-${date}-${rand}`;
}

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth();

    const { searchParams } = new URL(req.url);
    const userId = user.id;
    const role = user.role;

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
  } catch (error: unknown) {
    return errorResponse(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth();

    const userId = user.id;
    const body = await req.json();
    const { address, cartItemIds } = body;

    if (!Array.isArray(cartItemIds) || cartItemIds.length === 0) {
      return NextResponse.json({ error: "购物车为空" }, { status: 400 });
    }

    const uniqueCartItemIds = [...new Set(cartItemIds)];
    const cartItems = await prisma.cartItem.findMany({
      where: { id: { in: uniqueCartItemIds }, userId },
      include: { product: true },
    });

    if (cartItems.length !== uniqueCartItemIds.length) {
      return NextResponse.json(
        { error: "购物车项目无效" },
        { status: 400 }
      );
    }

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

      for (const item of orderItems) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { decrement: item.quantity } },
        });
      }

      await tx.cartItem.deleteMany({
        where: { id: { in: uniqueCartItemIds }, userId },
      });

      return o;
    });

    await createInstance({
      workflowType: "order_flow",
      targetType: "order",
      targetId: order.id,
      context: {
        orderNo,
        amount: totalAmount,
        operator: user.name ?? undefined,
      },
    });

    return NextResponse.json(order, { status: 201 });
  } catch (error: unknown) {
    return errorResponse(error);
  }
}
