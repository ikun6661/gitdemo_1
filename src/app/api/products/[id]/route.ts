import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { z } from "zod";

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  price: z.number().int().positive().optional(),
  stock: z.number().int().min(0).optional(),
  categoryId: z.string().optional(),
  images: z.array(z.string()).optional(),
  status: z.enum(["draft", "pending", "published"]).optional(),
});

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = await prisma.product.findUnique({ where: { id }, include: { category: true } });
  if (!product) return NextResponse.json({ error: "商品不存在" }, { status: 404 });
  return NextResponse.json(product);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const { id } = await params;
  try {
    const body = await req.json();
    const data = updateSchema.parse(body);
    const product = await prisma.product.update({ where: { id }, data: data as any });
    return NextResponse.json(product);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const { id } = await params;
  const orderItemCount = await prisma.orderItem.count({ where: { productId: id } });
  if (orderItemCount > 0) {
    return NextResponse.json({ error: "该商品已关联订单，不可删除" }, { status: 400 });
  }
  await prisma.product.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
