# EcomFlow 核心数据与认证权限设计

## 1. 背景

上一阶段已经把项目稳定到可开发基线：Next.js、Prisma、PostgreSQL、NextAuth、Vitest、lint 和 build 都能运行。当前阶段不追求一次完成完整商城交易，而是补齐后续业务必须依赖的核心数据结构和权限边界。

本阶段完成后，项目应具备清晰的用户角色、服务端权限校验、支付扩展数据模型、商品运营字段、稳定的注册登录体验和更真实的种子数据。

## 2. 目标

- 补齐 `Payment` 数据模型，为模拟支付和真实支付预留结构。
- 扩展 `Product`，支持 AI 商品运营文案字段和更完整的展示数据。
- 建立服务端认证与权限 helper，统一 API 和页面入口的权限判断。
- 修正登录、注册页面中文文案和基础校验体验。
- 强化 seed 数据，让演示账号、数码商品、工作流模板和商品文案足够支撑后续阶段。
- 增加权限和注册校验相关单元测试。
- 保持 `npm run test`、`npm run lint`、`npm run build` 通过。

## 3. 非目标

- 不实现完整购物车结算流程。
- 不实现模拟支付按钮和订单支付状态流转。
- 不实现 AI 文案生成 API 或页面。
- 不接入真实支付平台。
- 不做新的大规模页面视觉改版。

这些能力进入后续阶段实现。

## 4. 数据模型设计

### 4.1 Payment

新增 `Payment` 表，用于记录订单支付尝试。第一版使用模拟支付，但字段按真实支付扩展预留。

字段：

- `id`: 主键。
- `orderId`: 关联订单。
- `userId`: 关联付款用户。
- `amount`: 支付金额，单位为分。
- `provider`: 支付渠道，第一版默认为 `mock`。
- `status`: `pending`、`succeeded`、`failed`、`cancelled`。
- `transactionNo`: 外部支付流水号或模拟流水号。
- `rawPayload`: 支付平台原始响应，JSON 字符串。
- `paidAt`: 支付成功时间。
- `createdAt`、`updatedAt`: 时间戳。

关系：

- 一个订单可以有多条支付记录。
- 一个用户可以有多条支付记录。

### 4.2 Product 运营字段

扩展 `Product` 字段，服务后续 AI 商品运营和商品详情展示。

新增字段：

- `shortDescription`: 列表和摘要用短描述。
- `sellingPoints`: JSON 字符串，保存 3 到 5 条卖点。
- `specs`: JSON 字符串，保存参数配置。
- `seoKeywords`: JSON 字符串，保存 SEO 关键词。
- `aiSummary`: AI 生成的一句话推荐理由。
- `aiGeneratedAt`: AI 文案最后生成时间。

现阶段只补字段和 seed，不做 AI 生成接口。

### 4.3 业务状态常量

新增共享业务常量，减少散落字符串。

- 用户角色：`admin`、`operator`、`customer`。
- 商品状态：`draft`、`pending`、`published`、`rejected`。
- 订单状态：`pending_payment`、`paid`、`shipped`、`received`、`completed`、`cancelled`、`refunding`、`refunded`。
- 支付状态：`pending`、`succeeded`、`failed`、`cancelled`。

这些常量先作为 TypeScript 类型和数组提供，不强行把数据库字段改成 enum，避免本阶段迁移复杂化。

## 5. 认证与权限设计

新增 `src/server/auth/guards.ts`。

导出函数：

- `requireAuth()`: 必须登录，返回当前 session user；未登录抛出业务错误。
- `requireStaff()`: 必须是 `admin` 或 `operator`。
- `requireAdmin()`: 必须是 `admin`。
- `canAccessAdmin(role)`: 判断是否可以进入后台。

权限规则：

- `customer`: 可访问前台商品、购物车、自己的订单和退款。
- `operator`: 可访问后台商品、订单、工作流；不可管理用户角色。
- `admin`: 可访问全部后台能力，包括用户角色管理。

API 层必须做服务端权限校验。页面隐藏入口只是体验优化，不能替代服务端校验。

## 6. 登录注册体验

### 注册

把注册输入校验抽成可测试函数：

- 姓名不能为空。
- 邮箱必须是合法邮箱格式。
- 密码至少 6 位。
- 重复邮箱返回明确错误。
- 新注册用户固定为 `customer`。

注册成功后跳转登录页，并带成功提示参数。

### 登录

- 登录页修正为正常中文。
- 登录失败显示明确错误。
- 如果有 `callbackUrl`，登录成功后回到该地址。
- 否则按角色跳转：
  - `customer` 到 `/products`。
  - `operator` 和 `admin` 到 `/dashboard`。

角色跳转可以先由登录表单默认目标和受保护页面的 callbackUrl 共同完成；若需要精确按角色跳转，可在本阶段加入 `getDefaultRedirectForRole(role)`。

## 7. Seed 数据

seed 保留三类账号：

- `admin@ecomflow.com`
- `operator@ecomflow.com`
- `customer@ecomflow.com`

密码均为 `demo123456`。

商品数据继续使用数码电子品类，并补充：

- `shortDescription`
- `sellingPoints`
- `specs`
- `seoKeywords`
- `aiSummary`

商品状态至少覆盖 `published` 和 `pending`，为后台审核演示预留数据。

## 8. 测试设计

新增单元测试：

- `src/server/auth/guards.test.ts`
  - `canAccessAdmin("admin")` 为 true。
  - `canAccessAdmin("operator")` 为 true。
  - `canAccessAdmin("customer")` 为 false。
  - `getDefaultRedirectForRole("customer")` 返回 `/products`。
  - `getDefaultRedirectForRole("admin")` 和 `operator` 返回 `/dashboard`。

- `src/server/auth/register.test.ts`
  - 空姓名失败。
  - 非法邮箱失败。
  - 短密码失败。
  - 合法输入通过并规范化邮箱。

测试只覆盖纯函数，不依赖数据库。

## 9. 验收标准

- Prisma schema 包含 `Payment` 和商品运营字段。
- migration 文件已提交。
- seed 能写入增强后的演示商品数据。
- 权限 helper 存在并被后台用户 API、商品管理 API 等关键入口使用。
- 注册登录中文文案正常。
- 源码不新增显式 `any`。
- `npm run test` 通过。
- `npm run lint` 通过。
- `npm run build` 通过。

## 10. 风险与约束

- 当前本机没有 Docker/PostgreSQL，数据库迁移和 seed 的真实连库验证可能仍需在安装 Docker 后完成。
- 本阶段只提交迁移文件和代码验证；连库验证失败时需要明确记录环境原因。
- 由于数据库现有角色和状态字段是 `String`，本阶段先用 TypeScript 常量约束，不改为 Prisma enum。
