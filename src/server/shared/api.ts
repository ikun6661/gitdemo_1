import { NextResponse } from "next/server";
import { getErrorMessage } from "./errors";

export function unauthorized(message = "未登录") {
  return NextResponse.json({ error: message }, { status: 401 });
}

export function forbidden(message = "无权限") {
  return NextResponse.json({ error: message }, { status: 403 });
}

export function badRequest(error: unknown) {
  return NextResponse.json({ error: getErrorMessage(error) }, { status: 400 });
}

export function notFound(error: unknown) {
  return NextResponse.json({ error: getErrorMessage(error) }, { status: 404 });
}
