import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/server/auth/guards";
import { PRODUCT_STATUSES } from "@/server/domain/constants";
import { errorResponse } from "@/server/shared/api";
import { z } from "zod";

const createSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  shortDescription: z.string().optional(),
  price: z.number().int().positive(),
  stock: z.number().int().min(0),
  categoryId: z.string().min(1),
  images: z.array(z.string()).optional(),
  sellingPoints: z.array(z.string()).optional(),
  specs: z.record(z.string(), z.unknown()).optional(),
  seoKeywords: z.array(z.string()).optional(),
  aiSummary: z.string().optional(),
  status: z.enum(PRODUCT_STATUSES).optional(),
});

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const categoryId = searchParams.get("categoryId");
  const status = searchParams.get("status") ?? "published";
  const search = searchParams.get("search") ?? "";
  const page = Number(searchParams.get("page")) || 1;
  const pageSize = Number(searchParams.get("pageSize")) || 12;

  const where: Record<string, unknown> = {};
  if (categoryId) where.categoryId = categoryId;
  if (status) where.status = status;
  if (search) where.name = { contains: search };

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      include: { category: true },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.product.count({ where }),
  ]);

  // 解析 JSON 字符串字段
  const parsed = products.map((p) => ({
    ...p,
    images: typeof p.images === "string" ? JSON.parse(p.images) : p.images,
  }));

  return NextResponse.json({ products: parsed, total, page, pageSize });
}

export async function POST(req: NextRequest) {
  try {
    await requireStaff();
    const body = await req.json();
    const data = createSchema.parse(body);
    const { images, sellingPoints, specs, seoKeywords, ...productData } = data;
    const product = await prisma.product.create({
      data: {
        ...productData,
        images: JSON.stringify(images ?? []),
        sellingPoints: JSON.stringify(sellingPoints ?? []),
        specs: JSON.stringify(specs ?? {}),
        seoKeywords: JSON.stringify(seoKeywords ?? []),
      },
    });
    return NextResponse.json(product, { status: 201 });
  } catch (error: unknown) {
    return errorResponse(error);
  }
}
