import { NextRequest, NextResponse } from "next/server";
import { transition } from "@/server/workflow/engine";
import { auth } from "@/lib/auth";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "未登录" }, { status: 401 });
  try {
    const { id } = await params;
    const body = await req.json();
    const result = await transition({
      instanceId: id,
      trigger: body.trigger,
      operator: session.user?.name ?? "unknown",
      comment: body.comment ?? "",
    });
    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
