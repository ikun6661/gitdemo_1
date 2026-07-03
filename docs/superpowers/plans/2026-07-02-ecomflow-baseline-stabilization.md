# EcomFlow Baseline Stabilization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把现有 `ecom-flow` 半成品整理成可稳定开发的基线，让 `lint`、`build`、Prisma、种子数据和第一批单元测试都能可靠运行。

**Architecture:** 本计划只处理项目地基，不实现新的商城主功能。重点是隔离生成目录、统一数据库为 PostgreSQL、移除旧 LibSQL/自定义 Prisma Client 残留、建立测试脚手架、收敛 TypeScript 严格类型错误，并把 Next.js 16 的 `middleware` 迁移到 `proxy`。

**Tech Stack:** Next.js 16.2.6 App Router, React 19, TypeScript strict, Prisma 5.22, PostgreSQL, NextAuth v5 beta, Vitest, ESLint 9

---

## Scope Check

总设计文档覆盖商城、后台、支付、工作流、AI 和部署，不能放进一个实施计划。本计划是第 1 份计划，只覆盖“阶段 1：项目体检与修复”。完成后继续写下一份计划：核心数据与认证。

本计划完成时必须满足：

- `npm run lint` 不再扫描 `.worktrees/`、`.superpowers/`、`.next/`、`src/generated/`。
- Prisma 使用 PostgreSQL 和标准 `@prisma/client`。
- `prisma/seed.ts` 不再引用 `../src/generated/prisma/client` 和 LibSQL adapter。
- NextAuth 会话类型不再依赖 `(session.user as any)`。
- 现有 API、看板、演示页、Header 的显式 `any` 被替换为最小业务类型或 `unknown`。
- `src/middleware.ts` 迁移为 `src/proxy.ts`。
- 项目拥有 Vitest 测试脚手架和第一批工作流纯函数测试。
- `npm run lint`、`npm run test`、`npm run build` 通过。

## File Structure

### 修改

- `eslint.config.mjs`：补充全局忽略目录，防止 ESLint 扫描生成文件和辅助工作区。
- `tsconfig.json`：排除 `.worktrees`、`.superpowers`、`src/generated`，保留 `.next/types` 供 Next 类型生成使用。
- `package.json`：补充 `test`、`test:watch`、`typecheck`、`prisma:*` 脚本；安装 Vitest。
- `package-lock.json`：由 `npm install` 更新。
- `.env`：本地开发用，改为 PostgreSQL 连接字符串，不提交。
- `prisma/schema.prisma`：切换 datasource 为 PostgreSQL，继续输出标准 client。
- `prisma/seed.ts`：改用 `@prisma/client`，移除 LibSQL adapter，保留三类演示用户、数码分类、商品、三条工作流模板。
- `src/lib/prisma.ts`：保持标准 Prisma Client 单例。
- `src/lib/auth.ts`：移除显式 `any`，配合类型增强写入用户 `id` 和 `role`。
- `src/components/layout/Header.tsx`：使用强类型 session user。
- `src/server/workflow/types.ts`：补充工作流 JSON、上下文和响应类型。
- `src/server/workflow/engine.ts`：把 JSON 解析和边查找改成强类型工具函数。
- `src/app/dashboard/page.tsx`：去掉 `any`，使用 `WorkflowInstanceView`。
- `src/app/demo/page.tsx`：去掉 mutation error 的 `any`。
- `src/app/api/**/*.ts`：把 route handler 的 `catch (e: any)` 改为 `unknown`，动态路由参数使用 `RouteContext`。

### 新建

- `.env.example`：提交安全的环境变量模板。
- `src/types/auth.ts`：导出 `UserRole`、`AuthUser`。
- `src/types/next-auth.d.ts`：NextAuth/JWT 类型增强。
- `src/server/shared/errors.ts`：统一错误消息解析。
- `src/server/shared/api.ts`：统一 JSON 错误响应。
- `src/server/workflow/definition.ts`：可独立测试的工作流纯函数。
- `vitest.config.ts`：Vitest 配置。
- `src/server/workflow/definition.test.ts`：工作流纯函数测试。
- `src/proxy.ts`：Next.js 16 Proxy 文件。

### 删除

- `src/middleware.ts`：被 `src/proxy.ts` 替代。

---

## Task 1: 复现当前基线失败并隔离生成目录

**Files:**
- Modify: `eslint.config.mjs`
- Modify: `tsconfig.json`

- [ ] **Step 1: 运行当前 lint，确认失败原因**

Run:

```bash
npm run lint
```

Expected: FAIL。输出包含 `.worktrees\ecomflow-impl\.next\types\validator.ts` 和当前项目 `src/app/**` 的 `@typescript-eslint/no-explicit-any` 错误。

- [ ] **Step 2: 运行当前 build，确认失败原因**

Run:

```bash
npm run build
```

Expected: FAIL。输出包含：

```text
Type error: Cannot find module '../src/generated/prisma/client'
```

- [ ] **Step 3: 修改 ESLint 全局忽略**

Replace `eslint.config.mjs` with:

```js
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    ".next/**",
    ".superpowers/**",
    ".worktrees/**",
    "build/**",
    "coverage/**",
    "next-env.d.ts",
    "node_modules/**",
    "out/**",
    "src/generated/**",
  ]),
]);

export default eslintConfig;
```

- [ ] **Step 4: 修改 TypeScript 排除目录**

Replace `tsconfig.json` with:

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "react-jsx",
    "incremental": true,
    "plugins": [
      {
        "name": "next"
      }
    ],
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": [
    "next-env.d.ts",
    "**/*.ts",
    "**/*.tsx",
    ".next/types/**/*.ts",
    ".next/dev/types/**/*.ts",
    "**/*.mts"
  ],
  "exclude": [
    "node_modules",
    ".superpowers",
    ".worktrees",
    "coverage",
    "src/generated"
  ]
}
```

- [ ] **Step 5: 重新运行 lint，确认生成目录错误消失**

Run:

```bash
npm run lint
```

Expected: FAIL。输出不再包含 `.worktrees\ecomflow-impl\.next\types`，仍包含当前项目源码里的 `no-explicit-any` 错误。

- [ ] **Step 6: 提交目录隔离配置**

Run:

```bash
git add eslint.config.mjs tsconfig.json
git commit -m "chore: ignore generated helper directories in lint"
```

Expected: commit succeeds。

---

## Task 2: 统一 Prisma 为 PostgreSQL 标准客户端

**Files:**
- Create: `.env.example`
- Modify: `.env` (ignored local file)
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `prisma/schema.prisma`
- Modify: `prisma/seed.ts`
- Modify: `src/lib/prisma.ts`

- [ ] **Step 1: 安装测试依赖并移除未使用数据库适配器**

Run:

```bash
npm uninstall @libsql/client @prisma/adapter-libsql @prisma/adapter-pg
npm install -D vitest jsdom @testing-library/react @testing-library/jest-dom
```

Expected: `package.json` 不再包含 `@libsql/client`、`@prisma/adapter-libsql`、`@prisma/adapter-pg`；`devDependencies` 包含 Vitest 相关依赖。

- [ ] **Step 2: 修改 package scripts**

In `package.json`, set `scripts` to:

```json
{
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "eslint",
  "test": "vitest run",
  "test:watch": "vitest",
  "typecheck": "tsc --noEmit",
  "prisma:generate": "prisma generate",
  "prisma:migrate": "prisma migrate dev",
  "prisma:seed": "prisma db seed"
}
```

- [ ] **Step 3: 创建环境变量模板**

Create `.env.example`:

```env
DATABASE_URL="postgresql://ecomflow:ecomflow123@localhost:5432/ecomflow"
AUTH_SECRET="change-me-to-a-long-random-secret"
AUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="change-me-to-a-long-random-secret"
NEXTAUTH_URL="http://localhost:3000"
OPENAI_API_KEY=""
```

- [ ] **Step 4: 更新本地 .env**

Run:

```powershell
@'
DATABASE_URL="postgresql://ecomflow:ecomflow123@localhost:5432/ecomflow"
AUTH_SECRET="dev-secret-ecomflow-2026"
AUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="dev-secret-ecomflow-2026"
NEXTAUTH_URL="http://localhost:3000"
OPENAI_API_KEY=""
'@ | Set-Content -Encoding UTF8 .env
```

Expected: `.env` points to PostgreSQL and remains ignored by Git。

- [ ] **Step 5: 修改 Prisma datasource**

In `prisma/schema.prisma`, set the datasource block to:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

Keep the generator block:

```prisma
generator client {
  provider = "prisma-client-js"
}
```

- [ ] **Step 6: 替换 Prisma 单例**

Replace `src/lib/prisma.ts` with:

```ts
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
```

- [ ] **Step 7: 替换 seed 文件导入和客户端初始化**

Replace the first 8 lines of `prisma/seed.ts` with:

```ts
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
```

Then replace the three user creation statements with:

```ts
  await prisma.user.create({
    data: {
      name: "管理员",
      email: "admin@ecomflow.com",
      passwordHash,
      role: "admin",
    },
  });
  await prisma.user.create({
    data: {
      name: "运营小王",
      email: "operator@ecomflow.com",
      passwordHash,
      role: "operator",
    },
  });
  await prisma.user.create({
    data: {
      name: "演示用户",
      email: "customer@ecomflow.com",
      passwordHash,
      role: "customer",
    },
  });
```

This removes unused `admin`、`operator`、`customer` local variables.

- [ ] **Step 8: 启动 PostgreSQL**

Run:

```bash
docker compose up -d postgres
```

Expected: PostgreSQL container is running and port `5432` is available.

- [ ] **Step 9: 验证 Prisma**

Run:

```bash
npm run prisma:generate
npx prisma validate
```

Expected: PASS。Prisma Client generates to `node_modules/@prisma/client`。

- [ ] **Step 10: 运行迁移和种子**

Run:

```bash
npm run prisma:migrate -- --name baseline_postgres
npm run prisma:seed
```

Expected: migration succeeds; seed prints:

```text
用户创建完成
商品创建完成
工作流模板创建完成
```

- [ ] **Step 11: 提交 Prisma 标准化**

Run:

```bash
git add .env.example package.json package-lock.json prisma/schema.prisma prisma/seed.ts src/lib/prisma.ts prisma/migrations
git commit -m "chore: standardize prisma on postgres"
```

Expected: commit succeeds。

---

## Task 3: 建立测试脚手架和工作流纯函数测试

**Files:**
- Create: `vitest.config.ts`
- Modify: `src/server/workflow/types.ts`
- Create: `src/server/workflow/definition.ts`
- Create: `src/server/workflow/definition.test.ts`

- [ ] **Step 1: 创建 Vitest 配置**

Create `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
});
```

- [ ] **Step 2: 扩展工作流类型**

Replace `src/server/workflow/types.ts` with:

```ts
export interface WorkflowNode {
  key: string;
  label: string;
}

export interface WorkflowEdge {
  from: string;
  to: string;
  trigger: string;
  label: string;
}

export interface WorkflowDefinition {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

export type WorkflowType =
  | "order_flow"
  | "refund_approval"
  | "product_approval";

export type TargetType = "order" | "refund" | "product";

export type WorkflowStatus = "running" | "completed" | "cancelled";

export interface WorkflowContext {
  orderNo?: string;
  amount?: number;
  operator?: string;
  [key: string]: unknown;
}

export interface CreateInstanceInput {
  workflowType: WorkflowType;
  targetType: TargetType;
  targetId: string;
  context?: WorkflowContext;
}

export interface TransitionInput {
  instanceId: string;
  trigger: string;
  operator?: string;
  comment?: string;
}
```

- [ ] **Step 3: 先写失败测试**

Create `src/server/workflow/definition.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  findNextEdge,
  isEndNode,
  parseWorkflowDefinition,
} from "./definition";

const nodesJson = JSON.stringify([
  { key: "pending_payment", label: "待支付" },
  { key: "paid", label: "已支付" },
  { key: "shipped", label: "已发货" },
]);

const edgesJson = JSON.stringify([
  { from: "pending_payment", to: "paid", trigger: "pay", label: "支付" },
  { from: "paid", to: "shipped", trigger: "ship", label: "发货" },
]);

describe("workflow definition helpers", () => {
  it("parses nodes and edges from JSON strings", () => {
    const definition = parseWorkflowDefinition(nodesJson, edgesJson);

    expect(definition.nodes).toHaveLength(3);
    expect(definition.edges[0]).toEqual({
      from: "pending_payment",
      to: "paid",
      trigger: "pay",
      label: "支付",
    });
  });

  it("finds the next edge by current node and trigger", () => {
    const definition = parseWorkflowDefinition(nodesJson, edgesJson);

    const edge = findNextEdge("pending_payment", "pay", definition.edges);

    expect(edge).toEqual({
      from: "pending_payment",
      to: "paid",
      trigger: "pay",
      label: "支付",
    });
  });

  it("returns null when the transition is not allowed", () => {
    const definition = parseWorkflowDefinition(nodesJson, edgesJson);

    const edge = findNextEdge("pending_payment", "ship", definition.edges);

    expect(edge).toBeNull();
  });

  it("detects end nodes", () => {
    const definition = parseWorkflowDefinition(nodesJson, edgesJson);

    expect(isEndNode("shipped", definition.edges)).toBe(true);
    expect(isEndNode("paid", definition.edges)).toBe(false);
  });
});
```

- [ ] **Step 4: 运行测试确认失败**

Run:

```bash
npm run test -- src/server/workflow/definition.test.ts
```

Expected: FAIL with module not found for `./definition`.

- [ ] **Step 5: 实现工作流纯函数**

Create `src/server/workflow/definition.ts`:

```ts
import type { WorkflowDefinition, WorkflowEdge, WorkflowNode } from "./types";

function parseJsonArray<T>(raw: string, fieldName: string): T[] {
  const parsed: unknown = JSON.parse(raw);

  if (!Array.isArray(parsed)) {
    throw new Error(`${fieldName} 必须是数组`);
  }

  return parsed as T[];
}

export function parseWorkflowDefinition(
  nodesRaw: string,
  edgesRaw: string,
): WorkflowDefinition {
  return {
    nodes: parseJsonArray<WorkflowNode>(nodesRaw, "nodes"),
    edges: parseJsonArray<WorkflowEdge>(edgesRaw, "edges"),
  };
}

export function findNextEdge(
  currentNode: string,
  trigger: string,
  edges: WorkflowEdge[],
): WorkflowEdge | null {
  return (
    edges.find((edge) => edge.from === currentNode && edge.trigger === trigger) ??
    null
  );
}

export function isEndNode(nodeKey: string, edges: WorkflowEdge[]): boolean {
  return !edges.some((edge) => edge.from === nodeKey);
}
```

- [ ] **Step 6: 运行测试确认通过**

Run:

```bash
npm run test -- src/server/workflow/definition.test.ts
```

Expected: PASS with 4 tests.

- [ ] **Step 7: 提交测试脚手架**

Run:

```bash
git add vitest.config.ts src/server/workflow/types.ts src/server/workflow/definition.ts src/server/workflow/definition.test.ts package.json package-lock.json
git commit -m "test: add workflow definition unit tests"
```

Expected: commit succeeds。

---

## Task 4: 迁移 NextAuth 类型并移除认证相关 any

**Files:**
- Create: `src/types/auth.ts`
- Create: `src/types/next-auth.d.ts`
- Modify: `src/lib/auth.ts`
- Modify: `src/components/layout/Header.tsx`

- [ ] **Step 1: 创建角色类型**

Create `src/types/auth.ts`:

```ts
export type UserRole = "admin" | "operator" | "customer";

export interface AuthUser {
  id: string;
  name?: string | null;
  email?: string | null;
  role: UserRole;
}

export function isStaffRole(role: UserRole | undefined): boolean {
  return role === "admin" || role === "operator";
}
```

- [ ] **Step 2: 创建 NextAuth 类型增强**

Create `src/types/next-auth.d.ts`:

```ts
import type { DefaultSession } from "next-auth";
import type { JWT as DefaultJWT } from "next-auth/jwt";
import type { UserRole } from "./auth";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      role: UserRole;
    };
  }

  interface User {
    role: UserRole;
  }
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    id?: string;
    role?: UserRole;
  }
}
```

- [ ] **Step 3: 修改认证回调**

In `src/lib/auth.ts`, replace the callback block with:

```ts
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
      }
      return token;
    },
    async session({ session, token }) {
      if (token.id && token.role) {
        session.user.id = token.id;
        session.user.role = token.role;
      }
      return session;
    },
  },
```

The file must contain no `(user as any)` or `(session.user as any)`.

- [ ] **Step 4: 修改 Header 使用强类型用户**

Replace the first lines inside `Header` in `src/components/layout/Header.tsx`:

```ts
export async function Header() {
  const session = await auth();
  const user = session?.user;
```

Replace staff checks:

```tsx
              {(user.role === "admin" || user.role === "operator") && (
```

Keep admin check:

```tsx
              {user.role === "admin" && (
```

- [ ] **Step 5: 验证认证相关 any 消失**

Run:

```bash
rg -n "as any|: any" src/lib/auth.ts src/components/layout/Header.tsx src/types
```

Expected: no matches.

- [ ] **Step 6: 提交认证类型增强**

Run:

```bash
git add src/types/auth.ts src/types/next-auth.d.ts src/lib/auth.ts src/components/layout/Header.tsx
git commit -m "refactor: type authenticated users"
```

Expected: commit succeeds。

---

## Task 5: 迁移 Next.js 16 Proxy 并保留登录保护

**Files:**
- Create: `src/proxy.ts`
- Delete: `src/middleware.ts`

- [ ] **Step 1: 创建 Proxy 文件**

Create `src/proxy.ts`:

```ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const publicPaths = ["/login", "/register", "/api/auth"];
  if (publicPaths.some((path) => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  const sessionToken =
    req.cookies.get("authjs.session-token")?.value ??
    req.cookies.get("__Secure-authjs.session-token")?.value;

  if (!sessionToken) {
    const url = new URL("/login", req.url);
    url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|placeholder-.*).*)"],
};
```

- [ ] **Step 2: 删除旧 Middleware 文件**

Run:

```bash
git rm src/middleware.ts
```

Expected: `src/middleware.ts` is removed from Git.

- [ ] **Step 3: 运行 build 确认 deprecation warning 消失**

Run:

```bash
npm run build
```

Expected: FAIL until later tasks fix TypeScript errors, but output no longer contains:

```text
The "middleware" file convention is deprecated.
```

- [ ] **Step 4: 提交 Proxy 迁移**

Run:

```bash
git add src/proxy.ts
git commit -m "refactor: migrate middleware to next proxy"
```

Expected: commit succeeds。

---

## Task 6: 统一 API 错误处理并替换 route handler any

**Files:**
- Create: `src/server/shared/errors.ts`
- Create: `src/server/shared/api.ts`
- Modify: `src/app/api/cart/route.ts`
- Modify: `src/app/api/orders/route.ts`
- Modify: `src/app/api/products/route.ts`
- Modify: `src/app/api/products/[id]/route.ts`
- Modify: `src/app/api/refunds/route.ts`
- Modify: `src/app/api/users/route.ts`
- Modify: `src/app/api/users/[id]/route.ts`
- Modify: `src/app/api/workflows/instances/[id]/route.ts`
- Modify: `src/app/api/workflows/instances/[id]/transition/route.ts`

- [ ] **Step 1: 创建错误消息工具**

Create `src/server/shared/errors.ts`:

```ts
import { ZodError } from "zod";

export function getErrorMessage(error: unknown): string {
  if (error instanceof ZodError) {
    return error.issues.map((issue) => issue.message).join("；");
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "系统处理失败";
}
```

- [ ] **Step 2: 创建 API 响应工具**

Create `src/server/shared/api.ts`:

```ts
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
```

- [ ] **Step 3: 修改 catch 类型**

In every route file listed in this task, convert each `catch` block from this pattern:

```ts
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
```

with:

```ts
  } catch (error: unknown) {
    return badRequest(error);
  }
```

For 404 route handlers, use:

```ts
  } catch (error: unknown) {
    return notFound(error);
  }
```

Each modified file must import the helper it uses:

```ts
import { badRequest, notFound, unauthorized, forbidden } from "@/server/shared/api";
```

Only keep the imported names that the file actually uses.

- [ ] **Step 4: 使用 RouteContext 替换动态路由 params 类型**

In dynamic route files, replace:

```ts
{ params }: { params: Promise<{ id: string }> }
```

with the route-specific `RouteContext` type:

```ts
ctx: RouteContext<"/api/products/[id]">
```

Then read params with:

```ts
const { id } = await ctx.params;
```

Use exact route strings:

```ts
RouteContext<"/api/products/[id]">
RouteContext<"/api/users/[id]">
RouteContext<"/api/workflows/instances/[id]">
RouteContext<"/api/workflows/instances/[id]/transition">
```

- [ ] **Step 5: 移除产品写入里的 data as any**

In `src/app/api/products/route.ts`, replace:

```ts
const product = await prisma.product.create({ data: data as any });
```

with:

```ts
const product = await prisma.product.create({
  data: {
    ...data,
    images: JSON.stringify(data.images ?? []),
  },
});
```

In `src/app/api/products/[id]/route.ts`, replace:

```ts
const product = await prisma.product.update({ where: { id }, data: data as any });
```

with:

```ts
const product = await prisma.product.update({
  where: { id },
  data: {
    ...data,
    images: data.images ? JSON.stringify(data.images) : undefined,
  },
});
```

- [ ] **Step 6: 修复订单快照类型**

In `src/app/api/orders/route.ts`, replace:

```ts
snapshot: any;
```

with:

```ts
snapshot: {
  name: string;
  price: number;
  images: string;
};
```

- [ ] **Step 7: 验证 API route any 消失**

Run:

```bash
rg -n "as any|: any|catch \\(e: any\\)" src/app/api
```

Expected: no matches.

- [ ] **Step 8: 提交 API 错误处理**

Run:

```bash
git add src/server/shared/errors.ts src/server/shared/api.ts src/app/api
git commit -m "refactor: standardize api error handling"
```

Expected: commit succeeds。

---

## Task 7: 强类型化工作流引擎和看板页面

**Files:**
- Modify: `src/server/workflow/engine.ts`
- Modify: `src/app/dashboard/page.tsx`
- Modify: `src/app/demo/page.tsx`
- Modify: `src/app/(shop)/orders/page.tsx`
- Modify: `src/app/admin/products/page.tsx`
- Modify: `src/app/admin/users/page.tsx`

- [ ] **Step 1: 修改工作流引擎使用纯函数**

In `src/server/workflow/engine.ts`, replace local `parseNodes`、`parseEdges`、`findNextNode` with imports:

```ts
import {
  findNextEdge,
  isEndNode,
  parseWorkflowDefinition,
} from "./definition";
```

Then in `createInstance`, replace:

```ts
const nodes = parseNodes(workflow.nodes);
if (nodes.length === 0) throw new Error("工作流模板无节点");
const startNode = nodes[0].key;
```

with:

```ts
const definition = parseWorkflowDefinition(workflow.nodes, workflow.edges);
if (definition.nodes.length === 0) {
  throw new Error("工作流模板无节点");
}
const startNode = definition.nodes[0].key;
```

Then in `transition`, replace edge parsing and end detection with:

```ts
const definition = parseWorkflowDefinition(
  instance.workflow.nodes,
  instance.workflow.edges,
);
const next = findNextEdge(
  instance.currentNode,
  input.trigger,
  definition.edges,
);

if (!next) {
  throw new Error(
    `无效流转: 从 "${instance.currentNode}" 通过 "${input.trigger}"`,
  );
}

const hasEnded = isEndNode(next.to, definition.edges);
```

Use `hasEnded` for `status` and `endedAt`.

- [ ] **Step 2: 给 dashboard API 响应建本地类型**

In `src/app/dashboard/page.tsx`, replace `interface Instance` with:

```ts
interface WorkflowNodeView {
  key: string;
  label: string;
}

interface WorkflowEdgeView {
  from: string;
  to: string;
  trigger: string;
  label: string;
}

interface WorkflowLogView {
  toNode: string;
  action: string;
  createdAt: string;
}

interface WorkflowInstanceView {
  id: string;
  currentNode: string;
  status: string;
  targetType: string;
  targetId: string;
  context: {
    orderNo?: string;
    [key: string]: unknown;
  };
  workflow: {
    name: string;
    nodes: WorkflowNodeView[];
    edges: WorkflowEdgeView[];
  };
  logs: WorkflowLogView[];
}

interface WorkflowInstancesResponse {
  instances: WorkflowInstanceView[];
  total: number;
}
```

Then replace `renderInstances(data: any)` with:

```ts
function renderInstances(data: WorkflowInstancesResponse | undefined) {
```

Replace every `any[]` in this file with the view types above.

- [ ] **Step 3: 修改 dashboard mutation error**

Replace:

```ts
onError: (e: any) => toast.error(e.message || "操作失败"),
```

with:

```ts
onError: (error: Error) => toast.error(error.message || "操作失败"),
```

- [ ] **Step 4: 修改 demo mutation error**

In `src/app/demo/page.tsx`, replace:

```ts
onError: (e: any) => toast.error(e.message || "推进失败"),
```

with:

```ts
onError: (error: Error) => toast.error(error.message || "推进失败"),
```

- [ ] **Step 5: 修改购物订单页面 any**

In `src/app/(shop)/orders/page.tsx`, introduce:

```ts
interface OrderItemView {
  id: string;
  quantity: number;
  unitPrice: number;
  product: {
    name: string;
  };
}

interface OrderView {
  id: string;
  orderNo: string;
  totalAmount: number;
  status: string;
  createdAt: string;
  items: OrderItemView[];
}
```

Then replace:

```tsx
{(orders as any[]).map((order) => (
```

with:

```tsx
{(orders as OrderView[]).map((order) => (
```

- [ ] **Step 6: 修改后台商品页 mutation error**

In `src/app/admin/products/page.tsx`, replace:

```ts
onError: (e: any) => toast.error(e.message || "删除失败"),
```

with:

```ts
onError: (error: Error) => toast.error(error.message || "删除失败"),
```

- [ ] **Step 7: 修改后台用户页**

In `src/app/admin/users/page.tsx`, remove unused `Button` import and introduce:

```ts
interface UserView {
  id: string;
  name: string;
  email: string;
  role: "admin" | "operator" | "customer";
  createdAt: string;
}
```

Use `UserView[]` for user list rendering and `Error` for mutation error callback.

Replace:

```tsx
{(users as any[])?.map((u: any) => (
```

with:

```tsx
{(users as UserView[] | undefined)?.map((user) => (
```

Then rename `u` usages in that row to `user`, for example:

```tsx
<TableRow key={user.id}>
  <TableCell>{user.name}</TableCell>
  <TableCell>{user.email}</TableCell>
  <TableCell>
    <Badge variant={roleMap[user.role]?.variant}>
      {roleMap[user.role]?.label}
    </Badge>
  </TableCell>
  <TableCell>
    <select
      defaultValue={user.role}
      onChange={(event) =>
        roleMutation.mutate({ id: user.id, role: event.target.value })
      }
      className="border rounded px-2 py-1 text-sm"
    >
      <option value="admin">管理员</option>
      <option value="operator">运营</option>
      <option value="customer">用户</option>
    </select>
  </TableCell>
</TableRow>
```

- [ ] **Step 8: 验证页面和工作流 any 消失**

Run:

```bash
rg -n "as any|: any|any\\[\\]" src/server/workflow src/app/dashboard src/app/demo "src/app/(shop)/orders" src/app/admin
```

Expected: no matches.

- [ ] **Step 9: 运行测试**

Run:

```bash
npm run test -- src/server/workflow/definition.test.ts
```

Expected: PASS。

- [ ] **Step 10: 提交工作流和页面类型整理**

Run:

```bash
git add src/server/workflow src/app/dashboard src/app/demo "src/app/(shop)/orders" src/app/admin
git commit -m "refactor: type workflow and admin views"
```

Expected: commit succeeds。

---

## Task 8: 最终验证基线并记录剩余范围

**Files:**
- Modify: `README.md`

- [ ] **Step 1: 运行完整测试**

Run:

```bash
npm run test
```

Expected: PASS。

- [ ] **Step 2: 运行 lint**

Run:

```bash
npm run lint
```

Expected: PASS。

- [ ] **Step 3: 运行 build**

Run:

```bash
npm run build
```

Expected: PASS。

- [ ] **Step 4: 更新 README 的本地启动说明**

Add this section near the top of `README.md`:

```md
## 本地开发

1. 安装依赖：

   ```bash
   npm install
   ```

2. 复制环境变量：

   ```bash
   cp .env.example .env
   ```

   Windows PowerShell 可以使用：

   ```powershell
   Copy-Item .env.example .env
   ```

3. 启动数据库：

   ```bash
   docker compose up -d postgres redis
   ```

4. 初始化数据库：

   ```bash
   npm run prisma:migrate -- --name init
   npm run prisma:seed
   ```

5. 启动开发服务器：

   ```bash
   npm run dev
   ```

6. 访问：

   ```text
   http://localhost:3000
   ```

演示账号密码均为 `demo123456`：

- `admin@ecomflow.com`
- `operator@ecomflow.com`
- `customer@ecomflow.com`
```

- [ ] **Step 5: 提交 README 和基线验证**

Run:

```bash
git add README.md
git commit -m "docs: document local development baseline"
```

Expected: commit succeeds。

- [ ] **Step 6: 检查最终工作区**

Run:

```bash
git status --short
```

Expected: only pre-existing unrelated changes remain, or no changes remain if those were included by this plan.

---

## Self-Review Checklist

- Design coverage: 本计划覆盖设计文档中的阶段 1、测试设计的第一步、部署设计中的本地 PostgreSQL 基线。商城主链路、支付、AI、生产部署由后续计划覆盖。
- Placeholder scan: 未发现未落地的占位执行项。
- Type consistency: `UserRole`、`WorkflowDefinition`、`WorkflowInstanceView`、`RouteContext` 在任务中命名一致。
- Verification: 每个任务都有至少一个命令验证，最后以 `test`、`lint`、`build` 全绿作为完成条件。
