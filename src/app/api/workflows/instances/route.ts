import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/server/auth/guards";
import { errorResponse } from "@/server/shared/api";
import { listInstances } from "@/server/workflow/engine";

export async function GET(req: NextRequest) {
  try {
    await requireStaff();

    const { searchParams } = new URL(req.url);
    const items = await listInstances({
      workflowType: searchParams.get("workflowType") ?? undefined,
      targetType: searchParams.get("targetType") ?? undefined,
      status: searchParams.get("status") ?? undefined,
      limit: Number(searchParams.get("limit")) || 20,
      offset: Number(searchParams.get("offset")) || 0,
    });

    return NextResponse.json(items);
  } catch (error: unknown) {
    return errorResponse(error);
  }
}
