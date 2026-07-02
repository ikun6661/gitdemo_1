import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { badRequest, notFound, unauthorized } from "@/server/shared/api";
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

export async function GET(req: NextRequest, ctx: RouteContext<"/api/products/[id]">) {
  const { id } = await ctx.params;
  const product = await prisma.product.findUnique({ where: { id }, include: { category: true } });
  if (!product) return notFound(new Error("商品不存在"));
  return NextResponse.json(product);
}

export async function PUT(req: NextRequest, ctx: RouteContext<"/api/products/[id]">) {
  const session = await auth();
  if (!session) return unauthorized();
  const { id } = await ctx.params;
  try {
    const body = await req.json();
    const data = updateSchema.parse(body);
    const product = await prisma.product.update({
      where: { id },
      data: {
        ...data,
        images: data.images ? JSON.stringify(data.images) : undefined,
      },
    });
    return NextResponse.json(product);
  } catch (error: unknown) {
    return badRequest(error);
  }
}

export async function DELETE(req: NextRequest, ctx: RouteContext<"/api/products/[id]">) {
  const session = await auth();
  if (!session) return unauthorized();
  const { id } = await ctx.params;
  const orderItemCount = await prisma.orderItem.count({ where: { productId: id } });
  if (orderItemCount > 0) {
    return badRequest(new Error("该商品已关联订单，不可删除"));
  }
  await prisma.product.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
