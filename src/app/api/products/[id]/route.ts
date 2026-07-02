import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/server/auth/guards";
import { PRODUCT_STATUSES } from "@/server/domain/constants";
import { badRequest, errorResponse, notFound } from "@/server/shared/api";
import { z } from "zod";

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  shortDescription: z.string().optional(),
  price: z.number().int().positive().optional(),
  stock: z.number().int().min(0).optional(),
  categoryId: z.string().optional(),
  images: z.array(z.string()).optional(),
  sellingPoints: z.array(z.string()).optional(),
  specs: z.record(z.string(), z.unknown()).optional(),
  seoKeywords: z.array(z.string()).optional(),
  aiSummary: z.string().optional(),
  status: z.enum(PRODUCT_STATUSES).optional(),
});

export async function GET(req: NextRequest, ctx: RouteContext<"/api/products/[id]">) {
  const { id } = await ctx.params;
  const product = await prisma.product.findUnique({ where: { id }, include: { category: true } });
  if (!product) return notFound(new Error("商品不存在"));
  return NextResponse.json(product);
}

export async function PUT(req: NextRequest, ctx: RouteContext<"/api/products/[id]">) {
  try {
    await requireStaff();
    const { id } = await ctx.params;
    const body = await req.json();
    const data = updateSchema.parse(body);
    const { images, sellingPoints, specs, seoKeywords, ...productData } = data;
    const product = await prisma.product.update({
      where: { id },
      data: {
        ...productData,
        ...(images !== undefined ? { images: JSON.stringify(images) } : {}),
        ...(sellingPoints !== undefined
          ? { sellingPoints: JSON.stringify(sellingPoints) }
          : {}),
        ...(specs !== undefined ? { specs: JSON.stringify(specs) } : {}),
        ...(seoKeywords !== undefined
          ? { seoKeywords: JSON.stringify(seoKeywords) }
          : {}),
      },
    });
    return NextResponse.json(product);
  } catch (error: unknown) {
    return errorResponse(error);
  }
}

export async function DELETE(req: NextRequest, ctx: RouteContext<"/api/products/[id]">) {
  try {
    await requireStaff();
    const { id } = await ctx.params;
    const orderItemCount = await prisma.orderItem.count({ where: { productId: id } });
    if (orderItemCount > 0) {
      return badRequest(new Error("该商品已关联订单，不可删除"));
    }
    await prisma.product.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return errorResponse(error);
  }
}
