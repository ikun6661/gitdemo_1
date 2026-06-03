import { NextRequest, NextResponse } from "next/server";
import { listInstances } from "@/server/workflow/engine";
import { auth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const items = await listInstances({
    workflowType: searchParams.get("workflowType") ?? undefined,
    targetType: searchParams.get("targetType") ?? undefined,
    status: searchParams.get("status") ?? undefined,
    limit: Number(searchParams.get("limit")) || 20,
    offset: Number(searchParams.get("offset")) || 0,
  });

  return NextResponse.json(items);
}
