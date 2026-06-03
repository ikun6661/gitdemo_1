import { NextRequest, NextResponse } from "next/server";
import { getInstance } from "@/server/workflow/engine";
import { auth } from "@/lib/auth";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "未登录" }, { status: 401 });
  try {
    const { id } = await params;
    const instance = await getInstance(id);
    return NextResponse.json(instance);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 404 });
  }
}
