import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

// 获取当前用户的购物车
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const items = await prisma.cartItem.findMany({
    where: { userId: (session.user as any).id },
    include: { product: true },
  });

  return NextResponse.json(items);
}

// 添加商品到购物车
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const { productId, quantity } = await req.json();
  const userId = (session.user as any).id;

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
}

// 从购物车移除商品
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const { productId } = await req.json();
  const userId = (session.user as any).id;

  await prisma.cartItem.deleteMany({ where: { userId, productId } });
  return NextResponse.json({ success: true });
}
