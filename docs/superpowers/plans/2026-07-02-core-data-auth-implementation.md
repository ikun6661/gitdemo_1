# Core Data And Auth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 补齐 EcomFlow 的核心数据模型、认证权限边界、注册登录体验和演示数据，为后续商城主链路、模拟支付和 AI 商品运营打基础。

**Architecture:** 本阶段保持 Next.js 全栈单体架构。数据层通过 Prisma migration 扩展 `Payment` 与商品运营字段；权限逻辑集中到服务端 auth helper；注册校验和角色跳转抽成纯函数并用 Vitest 覆盖。API 和页面只接入必要权限，不做完整支付或 AI 生成流程。

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript strict, Prisma 5.22, PostgreSQL, NextAuth v5 beta, Vitest, ESLint 9

---

## Scope Check

本计划只覆盖规格 `docs/superpowers/specs/2026-07-02-core-data-auth-design.md` 中的“核心数据与认证权限”阶段。

本计划包含：

- `Payment` 数据模型和 migration。
- `Product` 商品运营字段和 seed 数据增强。
- 业务常量与角色跳转纯函数。
- 注册输入校验纯函数和注册页接入。
- 服务端权限 guards 和关键 API/后台页面接入。
- 登录/注册中文文案修正。
- 单元测试与最终 `test/lint/build` 验证。

本计划不包含：

- 完整购物车结算。
- 模拟支付按钮。
- 订单支付状态流转。
- AI 文案生成 API 或页面。
- 真实支付平台接入。

## File Structure

### 新建

- `src/server/domain/constants.ts`：集中定义角色、商品状态、订单状态、支付状态和默认角色跳转。
- `src/server/auth/register.ts`：注册输入校验与邮箱规范化纯函数。
- `src/server/auth/register.test.ts`：注册校验单元测试。
- `src/server/auth/guards.ts`：服务端认证与权限 guard。
- `src/server/auth/guards.test.ts`：角色访问与跳转单元测试。
- `prisma/migrations/20260702143000_core_data_auth/migration.sql`：本阶段数据库迁移。

### 修改

- `prisma/schema.prisma`：新增 `Payment`，扩展 `Product`，增加 User/Order payment 关系。
- `prisma/seed.ts`：清理 payment，并写入增强商品数据。
- `src/types/auth.ts`：复用或导出 `UserRole` 与角色判断，避免重复定义。
- `src/lib/auth.ts`：使用常量和角色类型，保持 session role 类型安全。
- `src/app/(auth)/register/page.tsx`：接入注册校验，修正中文文案和错误提示。
- `src/app/(auth)/login/page.tsx`：修正中文文案，支持注册成功提示和默认跳转。
- `src/app/admin/layout.tsx`：后台页面服务端 staff 权限保护，隐藏非 admin 用户管理入口。
- `src/app/api/users/route.ts`：使用 `requireAdmin()`。
- `src/app/api/users/[id]/route.ts`：使用 `requireAdmin()` 并校验角色。
- `src/app/api/products/route.ts`：后台创建商品需要 staff 权限，支持新增商品运营字段。
- `src/app/api/products/[id]/route.ts`：后台更新/删除商品需要 staff 权限，支持新增商品运营字段。
- `src/app/api/cart/route.ts`、`src/app/api/orders/route.ts`、`src/app/api/refunds/route.ts`：可选替换为 `requireAuth()`，保持行为一致。
- `README.md`：补充本阶段数据模型与权限说明。

---

## Task 1: 业务常量与注册校验纯函数

**Files:**
- Create: `src/server/domain/constants.ts`
- Create: `src/server/auth/register.ts`
- Create: `src/server/auth/register.test.ts`
- Create: `src/server/auth/guards.test.ts`
- Modify: `src/types/auth.ts`

- [ ] **Step 1: 创建业务常量**

Create `src/server/domain/constants.ts`:

```ts
export const USER_ROLES = ["admin", "operator", "customer"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const PRODUCT_STATUSES = [
  "draft",
  "pending",
  "published",
  "rejected",
] as const;
export type ProductStatus = (typeof PRODUCT_STATUSES)[number];

export const ORDER_STATUSES = [
  "pending_payment",
  "paid",
  "shipped",
  "received",
  "completed",
  "cancelled",
  "refunding",
  "refunded",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const PAYMENT_STATUSES = [
  "pending",
  "succeeded",
  "failed",
  "cancelled",
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export function isUserRole(role: string): role is UserRole {
  return USER_ROLES.includes(role as UserRole);
}

export function canAccessAdmin(role: UserRole | undefined): boolean {
  return role === "admin" || role === "operator";
}

export function getDefaultRedirectForRole(role: UserRole): string {
  return canAccessAdmin(role) ? "/dashboard" : "/products";
}
```

- [ ] **Step 2: 复用 UserRole 类型**

Replace `src/types/auth.ts` with:

```ts
import {
  canAccessAdmin,
  type UserRole,
} from "@/server/domain/constants";

export type { UserRole };

export interface AuthUser {
  id: string;
  name?: string | null;
  email?: string | null;
  role: UserRole;
}

export function isStaffRole(role: UserRole | undefined): boolean {
  return canAccessAdmin(role);
}
```

- [ ] **Step 3: 先写权限纯函数测试**

Create `src/server/auth/guards.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  canAccessAdmin,
  getDefaultRedirectForRole,
} from "@/server/domain/constants";

describe("auth role helpers", () => {
  it("allows admin and operator to access admin surfaces", () => {
    expect(canAccessAdmin("admin")).toBe(true);
    expect(canAccessAdmin("operator")).toBe(true);
  });

  it("does not allow customers to access admin surfaces", () => {
    expect(canAccessAdmin("customer")).toBe(false);
    expect(canAccessAdmin(undefined)).toBe(false);
  });

  it("chooses default redirect by role", () => {
    expect(getDefaultRedirectForRole("customer")).toBe("/products");
    expect(getDefaultRedirectForRole("operator")).toBe("/dashboard");
    expect(getDefaultRedirectForRole("admin")).toBe("/dashboard");
  });
});
```

- [ ] **Step 4: 创建注册校验测试**

Create `src/server/auth/register.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { validateRegisterInput } from "./register";

describe("validateRegisterInput", () => {
  it("rejects an empty name", () => {
    const result = validateRegisterInput({
      name: "",
      email: "customer@example.com",
      password: "demo123456",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("请输入姓名");
    }
  });

  it("rejects invalid email", () => {
    const result = validateRegisterInput({
      name: "演示用户",
      email: "not-email",
      password: "demo123456",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("请输入正确的邮箱");
    }
  });

  it("rejects short password", () => {
    const result = validateRegisterInput({
      name: "演示用户",
      email: "customer@example.com",
      password: "123",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("密码至少需要 6 位");
    }
  });

  it("accepts valid input and normalizes email", () => {
    const result = validateRegisterInput({
      name: " 演示用户 ",
      email: " CUSTOMER@Example.COM ",
      password: "demo123456",
    });

    expect(result).toEqual({
      ok: true,
      data: {
        name: "演示用户",
        email: "customer@example.com",
        password: "demo123456",
      },
    });
  });
});
```

- [ ] **Step 5: 运行测试确认失败**

Run:

```bash
npm run test -- src/server/auth/guards.test.ts src/server/auth/register.test.ts
```

Expected: FAIL because `./register` module does not exist. The guards tests may pass if constants are already present; the overall command must fail before implementation.

- [ ] **Step 6: 实现注册校验**

Create `src/server/auth/register.ts`:

```ts
export interface RegisterInput {
  name: string;
  email: string;
  password: string;
}

export type RegisterValidationResult =
  | { ok: true; data: RegisterInput }
  | { ok: false; error: string };

export function validateRegisterInput(
  input: RegisterInput,
): RegisterValidationResult {
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  const password = input.password;

  if (!name) {
    return { ok: false, error: "请输入姓名" };
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "请输入正确的邮箱" };
  }

  if (password.length < 6) {
    return { ok: false, error: "密码至少需要 6 位" };
  }

  return {
    ok: true,
    data: { name, email, password },
  };
}
```

- [ ] **Step 7: 运行测试确认通过**

Run:

```bash
npm run test -- src/server/auth/guards.test.ts src/server/auth/register.test.ts
```

Expected: PASS, 7 tests.

- [ ] **Step 8: 提交业务常量与注册校验**

Run:

```bash
git add src/server/domain/constants.ts src/server/auth/register.ts src/server/auth/register.test.ts src/server/auth/guards.test.ts src/types/auth.ts
git commit -m "test: add auth role and register validation"
```

Expected: commit succeeds.

---

## Task 2: Prisma 数据模型扩展与迁移

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260702143000_core_data_auth/migration.sql`

- [ ] **Step 1: 修改 Product 与 User/Order 关系**

In `prisma/schema.prisma`, add `payments Payment[]` to `User`:

```prisma
  payments  Payment[]
```

Add these fields to `Product` after `description`:

```prisma
  shortDescription String   @default("") @map("short_description")
  sellingPoints    String   @default("[]") @map("selling_points")
  specs            String   @default("{}")
  seoKeywords      String   @default("[]") @map("seo_keywords")
  aiSummary        String   @default("") @map("ai_summary")
  aiGeneratedAt    DateTime? @map("ai_generated_at")
```

Add `payments Payment[]` to `Order`:

```prisma
  payments          Payment[]
```

- [ ] **Step 2: 新增 Payment model**

Add after `OrderItem` in `prisma/schema.prisma`:

```prisma
model Payment {
  id            String    @id @default(cuid())
  orderId       String    @map("order_id")
  userId        String    @map("user_id")
  amount        Int
  provider      String    @default("mock")
  status        String    @default("pending")
  transactionNo String?   @map("transaction_no")
  rawPayload    String    @default("{}") @map("raw_payload")
  paidAt        DateTime? @map("paid_at")
  createdAt     DateTime  @default(now()) @map("created_at")
  updatedAt     DateTime  @updatedAt @map("updated_at")

  order Order @relation(fields: [orderId], references: [id], onDelete: Cascade)
  user  User  @relation(fields: [userId], references: [id])

  @@index([orderId])
  @@index([userId])
  @@unique([transactionNo])
  @@map("payments")
}
```

- [ ] **Step 3: 创建离线 migration**

Create the migration directory:

```powershell
New-Item -ItemType Directory -Force -Path prisma\migrations\20260702143000_core_data_auth | Out-Null
```

Create `prisma/migrations/20260702143000_core_data_auth/migration.sql` with exactly:

```sql
ALTER TABLE "products" ADD COLUMN "short_description" TEXT NOT NULL DEFAULT '';
ALTER TABLE "products" ADD COLUMN "selling_points" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "products" ADD COLUMN "specs" TEXT NOT NULL DEFAULT '{}';
ALTER TABLE "products" ADD COLUMN "seo_keywords" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "products" ADD COLUMN "ai_summary" TEXT NOT NULL DEFAULT '';
ALTER TABLE "products" ADD COLUMN "ai_generated_at" TIMESTAMP(3);

CREATE TABLE "payments" (
  "id" TEXT NOT NULL,
  "order_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "amount" INTEGER NOT NULL,
  "provider" TEXT NOT NULL DEFAULT 'mock',
  "status" TEXT NOT NULL DEFAULT 'pending',
  "transaction_no" TEXT,
  "raw_payload" TEXT NOT NULL DEFAULT '{}',
  "paid_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "payments_transaction_no_key" ON "payments"("transaction_no");
CREATE INDEX "payments_order_id_idx" ON "payments"("order_id");
CREATE INDEX "payments_user_id_idx" ON "payments"("user_id");

ALTER TABLE "payments"
  ADD CONSTRAINT "payments_order_id_fkey"
  FOREIGN KEY ("order_id") REFERENCES "orders"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "payments"
  ADD CONSTRAINT "payments_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
```

This migration must only add the new product columns and the `payments` table. It must not recreate baseline tables such as `users`, `products`, or `orders`.

- [ ] **Step 4: 验证 Prisma schema**

Run:

```bash
npx prisma validate
npm run prisma:generate
npm run typecheck
```

Expected: all pass.

- [ ] **Step 5: 检查 migration 内容**

Run:

```bash
rg -n "CREATE TABLE \"payments\"|short_description|selling_points|seo_keywords|ai_summary|ai_generated_at" prisma/migrations/20260702143000_core_data_auth/migration.sql
```

Expected: matches for the payments table and all product columns.

- [ ] **Step 6: 提交数据模型**

Run:

```bash
git add prisma/schema.prisma prisma/migrations/20260702143000_core_data_auth/migration.sql
git commit -m "feat: add core payment and product fields"
```

Expected: commit succeeds.

---

## Task 3: Seed 数据增强

**Files:**
- Modify: `prisma/seed.ts`

- [ ] **Step 1: 更新清理顺序**

In `prisma/seed.ts`, add payment cleanup before refunds/orders:

```ts
  await prisma.payment.deleteMany();
```

Place it after `await prisma.workflow.deleteMany();` and before `await prisma.refund.deleteMany();`.

- [ ] **Step 2: 替换商品创建数据**

In `prisma/seed.ts`, replace the six `prisma.product.create` calls with helper-based data. Add before `await Promise.all([...])`:

```ts
  const products = [
    {
      name: "iPhone 15",
      description: "Apple iPhone 15 128GB 黑色，适合日常拍照、视频和轻办公。",
      shortDescription: "轻巧耐用的 Apple 主力手机",
      price: 699900,
      stock: 100,
      images: ["/placeholder-iphone.jpg"],
      status: "published",
      sellingPoints: ["A16 仿生芯片", "4800 万像素主摄", "USB-C 接口"],
      specs: { storage: "128GB", color: "黑色", screen: "6.1 英寸" },
      seoKeywords: ["iPhone 15", "Apple 手机", "数码电子"],
      aiSummary: "适合想要稳定体验和优秀影像能力的主力机用户。",
    },
    {
      name: "MacBook Air M3",
      description: "Apple MacBook Air M3 13 英寸 8GB/256GB，适合学习、办公和轻量创作。",
      shortDescription: "轻薄长续航的 M3 笔记本",
      price: 899900,
      stock: 50,
      images: ["/placeholder-macbook.jpg"],
      status: "published",
      sellingPoints: ["M3 芯片", "轻薄机身", "全天候续航"],
      specs: { memory: "8GB", storage: "256GB", screen: "13 英寸" },
      seoKeywords: ["MacBook Air", "M3 笔记本", "轻薄本"],
      aiSummary: "适合需要便携办公和稳定续航的学生与职场用户。",
    },
    {
      name: "AirPods Pro 2",
      description: "Apple AirPods Pro 第二代 USB-C，支持主动降噪和空间音频。",
      shortDescription: "降噪表现优秀的真无线耳机",
      price: 189900,
      stock: 200,
      images: ["/placeholder-airpods.jpg"],
      status: "published",
      sellingPoints: ["主动降噪", "空间音频", "USB-C 充电盒"],
      specs: { connector: "USB-C", noiseCanceling: "主动降噪" },
      seoKeywords: ["AirPods Pro", "降噪耳机", "无线耳机"],
      aiSummary: "适合通勤、办公和 Apple 生态用户的高品质耳机。",
    },
    {
      name: "iPad Air M2",
      description: "Apple iPad Air M2 11 英寸 128GB，适合学习、绘画和移动办公。",
      shortDescription: "性能强劲的轻薄平板",
      price: 479900,
      stock: 80,
      images: ["/placeholder-ipad.jpg"],
      status: "published",
      sellingPoints: ["M2 芯片", "支持 Apple Pencil", "11 英寸 Liquid Retina 屏"],
      specs: { storage: "128GB", chip: "M2", screen: "11 英寸" },
      seoKeywords: ["iPad Air", "M2 平板", "Apple 平板"],
      aiSummary: "适合学习、创作和娱乐之间灵活切换的用户。",
    },
    {
      name: "Apple Watch Series 9",
      description: "Apple Watch Series 9 GPS 45mm，支持健康监测和运动记录。",
      shortDescription: "健康与运动管理智能手表",
      price: 319900,
      stock: 150,
      images: ["/placeholder-watch.jpg"],
      status: "published",
      sellingPoints: ["健康监测", "运动记录", "明亮显示屏"],
      specs: { size: "45mm", connectivity: "GPS" },
      seoKeywords: ["Apple Watch", "智能手表", "运动手表"],
      aiSummary: "适合重视健康提醒和运动记录的 Apple 用户。",
    },
    {
      name: "AirPods Max",
      description: "Apple AirPods Max 头戴式耳机，适合沉浸式音乐和影音体验。",
      shortDescription: "高端头戴式降噪耳机",
      price: 439900,
      stock: 30,
      images: ["/placeholder-airpodsmax.jpg"],
      status: "pending",
      sellingPoints: ["高保真音质", "主动降噪", "舒适头戴设计"],
      specs: { type: "头戴式", noiseCanceling: "主动降噪" },
      seoKeywords: ["AirPods Max", "头戴耳机", "高端耳机"],
      aiSummary: "适合追求沉浸式听感和高级质感的用户。",
    },
  ];
```

Then replace product creation with:

```ts
  await Promise.all(
    products.map((product) =>
      prisma.product.create({
        data: {
          name: product.name,
          description: product.description,
          shortDescription: product.shortDescription,
          price: product.price,
          stock: product.stock,
          categoryId: electronics.id,
          images: JSON.stringify(product.images),
          status: product.status,
          sellingPoints: JSON.stringify(product.sellingPoints),
          specs: JSON.stringify(product.specs),
          seoKeywords: JSON.stringify(product.seoKeywords),
          aiSummary: product.aiSummary,
          aiGeneratedAt: new Date(),
        },
      }),
    ),
  );
```

- [ ] **Step 3: 验证 seed 可编译**

Run:

```bash
npm run typecheck
```

Expected: PASS.

Run:

```bash
npm run prisma:seed
```

Expected in this environment: may FAIL with `Can't reach database server at localhost:5432` if Docker/PostgreSQL is unavailable. If it fails only for database connectivity, record it as environment limitation. It must not fail for TypeScript syntax or Prisma Client field errors.

- [ ] **Step 4: 提交 seed 增强**

Run:

```bash
git add prisma/seed.ts
git commit -m "chore: enrich seed data"
```

Expected: commit succeeds.

---

## Task 4: 服务端权限 guards

**Files:**
- Create: `src/server/auth/guards.ts`
- Modify: `src/app/api/users/route.ts`
- Modify: `src/app/api/users/[id]/route.ts`
- Modify: `src/app/api/products/route.ts`
- Modify: `src/app/api/products/[id]/route.ts`
- Modify: `src/app/api/cart/route.ts`
- Modify: `src/app/api/orders/route.ts`
- Modify: `src/app/api/refunds/route.ts`

- [ ] **Step 1: 创建权限 guard**

Create `src/server/auth/guards.ts`:

```ts
import { auth } from "@/lib/auth";
import { canAccessAdmin, isUserRole, type UserRole } from "@/server/domain/constants";
import type { AuthUser } from "@/types/auth";

export class AuthRequiredError extends Error {
  constructor() {
    super("未登录");
    this.name = "AuthRequiredError";
  }
}

export class PermissionDeniedError extends Error {
  constructor() {
    super("无权限");
    this.name = "PermissionDeniedError";
  }
}

export async function requireAuth(): Promise<AuthUser> {
  const session = await auth();

  if (!session?.user) {
    throw new AuthRequiredError();
  }

  return session.user;
}

export async function requireStaff(): Promise<AuthUser> {
  const user = await requireAuth();

  if (!canAccessAdmin(user.role)) {
    throw new PermissionDeniedError();
  }

  return user;
}

export async function requireAdmin(): Promise<AuthUser> {
  const user = await requireAuth();

  if (user.role !== "admin") {
    throw new PermissionDeniedError();
  }

  return user;
}

export function parseUserRole(role: unknown): UserRole | null {
  if (typeof role !== "string" || !isUserRole(role)) {
    return null;
  }

  return role;
}
```

- [ ] **Step 2: 修改 API 错误 helper 识别权限错误**

Modify `src/server/shared/api.ts` to import errors:

```ts
import {
  AuthRequiredError,
  PermissionDeniedError,
} from "@/server/auth/guards";
```

Add:

```ts
export function errorResponse(error: unknown) {
  if (error instanceof AuthRequiredError) {
    return unauthorized(error.message);
  }

  if (error instanceof PermissionDeniedError) {
    return forbidden(error.message);
  }

  return badRequest(error);
}
```

- [ ] **Step 3: 接入用户 API**

In `src/app/api/users/route.ts`, replace direct `auth()` logic with:

```ts
import { requireAdmin } from "@/server/auth/guards";
import { errorResponse } from "@/server/shared/api";
```

Wrap handler:

```ts
export async function GET() {
  try {
    await requireAdmin();
    const users = await prisma.user.findMany({
      select: { id: true, name: true, email: true, role: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(users);
  } catch (error: unknown) {
    return errorResponse(error);
  }
}
```

In `src/app/api/users/[id]/route.ts`, use:

```ts
import { requireAdmin, parseUserRole } from "@/server/auth/guards";
import { badRequest, errorResponse } from "@/server/shared/api";
```

Inside PUT:

```ts
  try {
    await requireAdmin();
    const { id } = await ctx.params;
    const { role } = await req.json();
    const nextRole = parseUserRole(role);
    if (!nextRole) {
      return badRequest(new Error("角色无效"));
    }
    const user = await prisma.user.update({
      where: { id },
      data: { role: nextRole },
    });
    return NextResponse.json(user);
  } catch (error: unknown) {
    return errorResponse(error);
  }
```

- [ ] **Step 4: 接入商品管理 API**

In `src/app/api/products/route.ts`, replace POST auth check with `await requireStaff()` inside try:

```ts
import { requireStaff } from "@/server/auth/guards";
import { badRequest, errorResponse } from "@/server/shared/api";
```

POST catch should return `errorResponse(error)` so auth and validation errors map correctly.

In `src/app/api/products/[id]/route.ts`, use `await requireStaff()` in PUT and DELETE before modifying data. Keep GET public.

- [ ] **Step 5: 接入前台私有 API**

In `src/app/api/cart/route.ts`, replace `const session = await auth()` with:

```ts
const user = await requireAuth();
```

Wrap GET/POST/DELETE in try/catch and return `errorResponse(error)` in catch. Use `user.id`.

In `src/app/api/orders/route.ts`, use `const user = await requireAuth();` and `user.id`, `user.role`.

In `src/app/api/refunds/route.ts`, use `const user = await requireAuth();` and `user.id`.

- [ ] **Step 6: 验证权限 API 编译**

Run:

```bash
npm run typecheck
npm run lint
```

Expected: PASS.

Run:

```bash
rg -n "auth\\(\\)|session\\.user|session\\.user as" src/app/api/users src/app/api/products src/app/api/cart src/app/api/orders src/app/api/refunds
```

Expected: no `session.user as` matches; direct `auth()` should not remain in these API routes.

- [ ] **Step 7: 提交权限 guards**

Run:

```bash
git add src/server/auth/guards.ts src/server/shared/api.ts src/app/api/users src/app/api/products src/app/api/cart src/app/api/orders src/app/api/refunds
git commit -m "refactor: centralize auth guards"
```

Expected: commit succeeds.

---

## Task 5: 注册登录页面体验

**Files:**
- Modify: `src/app/(auth)/register/page.tsx`
- Modify: `src/app/(auth)/login/page.tsx`
- Modify: `src/lib/auth.ts`

- [ ] **Step 1: 修改注册页文案和校验**

In `src/app/(auth)/register/page.tsx`, import:

```ts
import { validateRegisterInput } from "@/server/auth/register";
```

In server action, replace raw validation with:

```ts
const result = validateRegisterInput({ name, email, password });
if (!result.ok) {
  redirect(`/register?error=${encodeURIComponent(result.error)}`);
}

const existing = await prisma.user.findUnique({
  where: { email: result.data.email },
});
if (existing) {
  redirect(`/register?error=${encodeURIComponent("该邮箱已被注册")}`);
}

const passwordHash = await bcrypt.hash(result.data.password, 10);
await prisma.user.create({
  data: {
    name: result.data.name,
    email: result.data.email,
    passwordHash,
    role: "customer",
  },
});

redirect("/login?registered=1");
```

Replace visible Chinese text:

```tsx
<CardTitle className="text-center text-2xl">注册 EcomFlow</CardTitle>
<Label htmlFor="name">姓名</Label>
<Input id="name" name="name" placeholder="张三" required />
<Label htmlFor="email">邮箱</Label>
<Input id="email" name="email" type="email" placeholder="zhangsan@example.com" required />
<Label htmlFor="password">密码</Label>
<Input id="password" name="password" type="password" placeholder="至少 6 位" required minLength={6} />
{sp?.error && <p className="text-sm text-red-500">{sp.error}</p>}
<Button type="submit" className="w-full">注册</Button>
<p className="text-center text-sm text-gray-500">
  已有账号？<Link href="/login" className="underline">去登录</Link>
</p>
```

- [ ] **Step 2: 修改登录页文案、成功提示和角色默认跳转**

In `src/app/(auth)/login/page.tsx`, include `registered?: string` in search params type.

Import:

```ts
import { getDefaultRedirectForRole, isUserRole } from "@/server/domain/constants";
import { prisma } from "@/server/prisma";
```

In the login server action, normalize email and choose a role-aware fallback redirect:

```ts
const email = String(formData.get("email") ?? "")
  .trim()
  .toLowerCase();
const password = String(formData.get("password") ?? "");

const existingUser = await prisma.user.findUnique({
  where: { email },
  select: { role: true },
});

const callbackUrl =
  sp?.callbackUrl ||
  (existingUser && isUserRole(existingUser.role)
    ? getDefaultRedirectForRole(existingUser.role)
    : "/products");

await signIn("credentials", {
  email,
  password,
  redirectTo: callbackUrl,
});
```

Replace visible Chinese text:

```tsx
<CardTitle className="text-center text-2xl">登录 EcomFlow</CardTitle>
<Label htmlFor="email">邮箱</Label>
<Input id="email" name="email" type="email" placeholder="admin@ecomflow.com" required />
<Label htmlFor="password">密码</Label>
<Input id="password" name="password" type="password" placeholder="demo123456" required />
{sp?.registered && <p className="text-sm text-green-600">注册成功，请登录</p>}
{sp?.error && <p className="text-sm text-red-500">邮箱或密码错误，请重试</p>}
<Button type="submit" className="w-full">登录</Button>
<p className="text-center text-sm text-gray-500">
  还没有账号？<Link href="/register" className="underline">立即注册</Link>
</p>
```

- [ ] **Step 3: 修正 Credentials 字段中文和邮箱规范化**

In `src/lib/auth.ts`, replace credentials labels:

```ts
email: { label: "邮箱", type: "email" },
password: { label: "密码", type: "password" },
```

In the `authorize` callback, normalize the email before lookup:

```ts
const email = String(credentials?.email ?? "")
  .trim()
  .toLowerCase();
const password = String(credentials?.password ?? "");

const user = await prisma.user.findUnique({
  where: { email },
});
```

- [ ] **Step 4: 验证页面中文**

Run:

```bash
node -e "const fs=require('fs'); for (const file of ['src/app/(auth)/login/page.tsx','src/app/(auth)/register/page.tsx','src/lib/auth.ts']) { const s=fs.readFileSync(file,'utf8'); console.log(file, /登录 EcomFlow|注册 EcomFlow|邮箱|密码/.test(s)); }"
```

Expected: each line ends with `true`.

Run:

```bash
npm run typecheck
npm run lint
```

Expected: PASS.

- [ ] **Step 5: 提交登录注册体验**

Run:

```bash
git add "src/app/(auth)/register/page.tsx" "src/app/(auth)/login/page.tsx" src/lib/auth.ts
git commit -m "refactor: improve auth forms"
```

Expected: commit succeeds.

---

## Task 6: 后台页面权限入口

**Files:**
- Modify: `src/app/admin/layout.tsx`
- Modify: `src/app/dashboard/layout.tsx`
- Modify: `src/components/layout/Header.tsx`

- [ ] **Step 1: 后台 layout 接入 staff 权限**

In `src/app/admin/layout.tsx`, import:

```ts
import { redirect } from "next/navigation";
import { requireStaff } from "@/server/auth/guards";
```

Make component async:

```tsx
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let user;
  try {
    user = await requireStaff();
  } catch {
    redirect("/login?callbackUrl=/admin/products");
  }
```

Render user management link only for admin:

```tsx
{user.role === "admin" && (
  <Link href="/admin/users" className="block px-3 py-2 rounded-md text-sm hover:bg-gray-100">
    用户管理
  </Link>
)}
```

Fix visible Chinese text:

```tsx
<h1 className="text-2xl font-bold mb-6">管理后台</h1>
商品管理
用户管理
```

- [ ] **Step 2: Dashboard layout 接入 staff 权限**

In `src/app/dashboard/layout.tsx`, import:

```ts
import { redirect } from "next/navigation";
import { requireStaff } from "@/server/auth/guards";
```

Before render:

```tsx
try {
  await requireStaff();
} catch {
  redirect("/login?callbackUrl=/dashboard");
}
```

- [ ] **Step 3: Header 后台入口按角色显示**

In `src/components/layout/Header.tsx`, ensure:

```tsx
{isStaffRole(user.role) && (
  <>
    <Link href="/dashboard" className="text-sm hover:underline">看板</Link>
    <Link href="/demo" className="text-sm hover:underline">演示</Link>
  </>
)}
{user.role === "admin" && (
  <Link href="/admin/products" className="text-sm hover:underline">管理</Link>
)}
```

If the text is already correct, leave behavior unchanged.

- [ ] **Step 4: 验证权限页面编译**

Run:

```bash
npm run typecheck
npm run lint
```

Expected: PASS.

- [ ] **Step 5: 提交后台权限入口**

Run:

```bash
git add src/app/admin/layout.tsx src/app/dashboard/layout.tsx src/components/layout/Header.tsx
git commit -m "refactor: protect admin surfaces"
```

Expected: commit succeeds.

---

## Task 7: README 和最终验证

**Files:**
- Modify: `README.md`

- [ ] **Step 1: 更新 README 阶段说明**

Add after the intro paragraph in `README.md`:

```md
## 当前能力

- PostgreSQL + Prisma 数据模型包含用户、商品、购物车、订单、支付记录、退款和工作流。
- NextAuth credentials 登录，支持 `customer`、`operator`、`admin` 三类角色。
- 后台入口和关键 API 使用服务端权限校验。
- 商品数据包含 AI 商品运营预留字段，后续可接入真实 AI 文案生成。
```

- [ ] **Step 2: 完整验证**

Run:

```bash
npm run test
npm run lint
npm run build
```

Expected: all pass.

Run:

```bash
rg -n "as any|: any|catch \\(e: any\\)|any\\[\\]" src
```

Expected: no matches.

- [ ] **Step 3: 数据库环境记录**

Run:

```powershell
Test-NetConnection -ComputerName localhost -Port 5432 | Format-List ComputerName,TcpTestSucceeded
```

Expected in current environment: likely `TcpTestSucceeded : False`. Record as environment limitation if PostgreSQL is not running.

- [ ] **Step 4: 提交 README**

Run:

```bash
git add README.md
git commit -m "docs: document core data auth baseline"
```

Expected: commit succeeds.

- [ ] **Step 5: 最终状态**

Run:

```bash
git status --short --branch
git log --oneline -10
```

Expected: clean worktree on `baseline-stabilization`.

---

## Self-Review Checklist

- Spec coverage: covers Payment, Product AI fields, constants, guards, register validation, seed, auth forms, admin protection, README, and verification.
- Placeholder scan: no unfinished markers.
- Type consistency: `UserRole` comes from `src/server/domain/constants.ts` and is re-exported by `src/types/auth.ts`; guards return `AuthUser`; status fields remain strings in Prisma.
- Testing: pure functions get Vitest tests; final `test/lint/build` required.
- Environment: database connectivity limitation is explicitly recorded and does not block code-level verification.
