import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/server/auth/guards";
import { errorResponse } from "@/server/shared/api";

// 获取当前用户的购物车
export async function GET() {
  try {
    const user = await requireAuth();

    const items = await prisma.cartItem.findMany({
      where: { userId: user.id },
      include: { product: true },
    });

    return NextResponse.json(items);
  } catch (error: unknown) {
    return errorResponse(error);
  }
}

// 添加商品到购物车
export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth();

    const { productId, quantity } = await req.json();
    const userId = user.id;

    const existing = await prisma.cartItem.findUnique({
      where: { userId_productId: { userId, productId } },
    });

    if (existing) {
      const item = await prisma.cartItem.update({
        where: { id: existing.id },
        data: { quantity: existing.quantity + (quantity ?? 1) },
      });
      return NextResponse.json(item);
    }

    const item = await prisma.cartItem.create({
      data: { userId, productId, quantity: quantity ?? 1 },
    });
    return NextResponse.json(item, { status: 201 });
  } catch (error: unknown) {
    return errorResponse(error);
  }
}

// 从购物车移除商品
export async function DELETE(req: NextRequest) {
  try {
    const user = await requireAuth();

    const { productId } = await req.json();
    const userId = user.id;

    await prisma.cartItem.deleteMany({ where: { userId, productId } });
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return errorResponse(error);
  }
}
