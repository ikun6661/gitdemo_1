import { NextResponse } from "next/server";
import {
  AuthRequiredError,
  PermissionDeniedError,
} from "@/server/auth/guards";
import { ZodError } from "zod";
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

export function serverError() {
  return NextResponse.json({ error: "服务器错误" }, { status: 500 });
}

export function errorResponse(error: unknown) {
  if (error instanceof AuthRequiredError) {
    return unauthorized(error.message);
  }

  if (error instanceof PermissionDeniedError) {
    return forbidden(error.message);
  }

  if (error instanceof ZodError) {
    return badRequest(error);
  }

  return serverError();
}
