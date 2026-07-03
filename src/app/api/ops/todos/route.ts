import { type NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/server/auth/guards";
import {
  listOpsTodos,
  type OpsTodoType,
} from "@/server/operations/todos";
import { errorResponse } from "@/server/shared/api";

function parseTodoType(type: string | null): OpsTodoType | undefined {
  if (type === "order" || type === "refund" || type === "product") {
    return type;
  }

  return undefined;
}

export async function GET(req: NextRequest) {
  try {
    await requireStaff();

    const { searchParams } = new URL(req.url);
    const result = await listOpsTodos({
      type: parseTodoType(searchParams.get("type")),
      status: searchParams.get("status") ?? undefined,
      search: searchParams.get("search") ?? undefined,
    });

    return NextResponse.json(result);
  } catch (error: unknown) {
    return errorResponse(error);
  }
}
