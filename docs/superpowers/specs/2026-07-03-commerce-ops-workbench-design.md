# EcomFlow 运营工作台设计

## 1. 背景

当前系统已经具备 PostgreSQL + Prisma 数据模型、NextAuth 认证、角色权限、商品管理、订单、退款、工作流实例和 Docker Compose 部署基础。`/dashboard` 也已经能展示工作流实例并推进节点。

但现在的后台还更像“工作流实例列表”，运营人员需要理解订单、退款、商品审核各自藏在哪里，也无法从一个统一视角判断“今天要先处理什么”。此外，现有工作流推进主要改变 `WorkflowInstance.currentNode`，没有稳定地同步订单、退款、商品本体状态。商用系统里，流程状态和业务状态必须一起变化，否则页面显示会和真实业务脱节。

本阶段选择先建设“运营工作台”，把订单、退款、商品审核聚合成统一待办，并在卡片上完成快捷处理。

## 2. 目标

- 把订单待发货、退款待审核、商品待审核聚合到 `/dashboard`。
- 提供统计卡片、类型筛选、状态筛选和搜索能力。
- 提供统一待办 API，让前端不需要分别理解订单、退款、商品三套数据结构。
- 提供统一快捷处理 API，让一次操作同时推进工作流并同步业务实体状态。
- 保持 `admin` 和 `operator` 可访问工作台，`customer` 不可访问。
- 增加服务层和 API 测试，避免工作流推进与业务状态不同步。

## 3. 非目标

- 不接真实支付渠道。
- 不接真实物流 API。
- 不实现完整用户端支付闭环。
- 不接入 OpenAI 或其他 AI 文案接口。
- 不实现拖拽式工作流编辑器。
- 不改变现有数据库表结构，除非实施时发现现有字段无法表达本阶段验收标准。

## 4. 选定方案

本阶段采用“统一运营待办层”方案。

新增一个服务层负责把不同业务对象转换成统一的 `OpsTodo`。前端只消费一种待办数据；订单、退款、商品审核的差异留在服务层和动作处理层中。

备选方案曾包括：

- 继续在 `/dashboard` 直接展示工作流实例：改动小，但用户仍要理解底层流程，不像商用后台。
- 先做订单支付闭环：用户端体验更完整，但后台运营价值还没有被串起来。
- 先做 AI 商品文案：更贴近 AI 主题，但会引入 API key、成本、失败兜底和提示词治理，本阶段优先级低于核心运营闭环。

## 5. 数据模型与类型设计

不新增数据库表。运营待办是服务层组合结果。

核心类型：

```ts
export type OpsTodoType = "order" | "refund" | "product";

export type OpsTodoStatusTone =
  | "yellow"
  | "blue"
  | "green"
  | "red"
  | "gray"
  | "orange";

export interface OpsTodoAction {
  key: string;
  label: string;
  variant: "default" | "outline" | "destructive";
  requiresComment?: boolean;
}

export interface OpsTodo {
  id: string;
  type: OpsTodoType;
  title: string;
  subtitle: string;
  status: string;
  statusLabel: string;
  statusTone: OpsTodoStatusTone;
  targetId: string;
  workflowInstanceId?: string;
  amount?: number;
  customerName?: string;
  createdAt: string;
  actions: OpsTodoAction[];
}

export interface OpsTodoSummary {
  total: number;
  orders: number;
  refunds: number;
  products: number;
}

export interface OpsTodoListResponse {
  summary: OpsTodoSummary;
  todos: OpsTodo[];
}
```

`OpsTodo.id` 使用带前缀的稳定字符串：

- `order:<workflowInstanceId>`
- `refund:<workflowInstanceId>`
- `product:<productId>`

商品待审可以来自 `WorkflowInstance`，也可以来自 `Product.status === "pending"`。为了兼容当前 seed 中已有的待审商品，本阶段允许商品待办没有 `workflowInstanceId`。

## 6. 待办聚合规则

### 6.1 订单待办

订单待办主要服务运营发货。

- 来源：运行中的 `WorkflowInstance`，`targetType = "order"`。
- 只把需要运营处理的节点显示为待办。
- 第一版显示：
  - `currentNode = "paid"`：动作 `ship`，按钮文案“确认发货”。
- `pending_payment` 是等待顾客支付，不计入运营待办。
- `shipped`、`received`、`completed` 不计入运营待办，后续支付/收货阶段再扩展。

执行 `ship` 后：

- 推进工作流实例：`paid -> shipped`。
- 更新订单：`Order.status = "shipped"`。
- 写入工作流日志，操作人为当前用户姓名。

### 6.2 退款待办

退款待办服务审核流程。

- 来源：运行中的 `WorkflowInstance`，`targetType = "refund"`。
- 可显示节点：
  - `pending_review`：动作 `submit` 和 `reject`。
  - `cs_review`：动作 `cs_approve` 和 `cs_reject`。
  - `manager_approval`：动作 `manager_approve` 和 `manager_reject`。

执行通过类动作后：

- 推进工作流实例到下一节点。
- 中间节点不改变最终退款状态，只保留 `Refund.status = "pending"`。
- 到达 `approved` 后，更新 `Refund.status = "approved"`，并把关联订单更新为 `Order.status = "refunded"`。

执行驳回类动作后：

- 推进工作流实例到 `rejected`。
- 更新 `Refund.status = "rejected"`。
- 关联订单保持原状态，避免误把正常订单关闭。

### 6.3 商品审核待办

商品审核待办服务上架审批。

- 来源一：`Product.status = "pending"`。
- 来源二：运行中的 `WorkflowInstance`，`targetType = "product"`。
- 如果同一个商品同时有 pending 状态和 workflow instance，前端只显示一张待办卡。

动作：

- `approve`：审核通过，更新 `Product.status = "published"`。
- `reject`：驳回，更新 `Product.status = "rejected"`。

如果存在对应 `WorkflowInstance`：

- 同步推进工作流到 `published` 或 `rejected`。
- 写入工作流日志。

如果不存在对应 `WorkflowInstance`：

- 直接更新商品状态。
- 本阶段不强制补建历史工作流实例，避免为了兼容旧数据引入额外复杂度。

## 7. API 设计

### 7.1 查询待办

新增：

```http
GET /api/ops/todos?type=order&status=paid&search=ORD
```

权限：

- 必须登录。
- 必须是 `admin` 或 `operator`。

查询参数：

- `type`: 可选，`order`、`refund`、`product`。
- `status`: 可选，按待办状态过滤。
- `search`: 可选，匹配订单号、商品名、退款原因、顾客姓名。

响应：

```json
{
  "summary": {
    "total": 12,
    "orders": 8,
    "refunds": 3,
    "products": 1
  },
  "todos": []
}
```

### 7.2 执行动作

新增：

```http
POST /api/ops/todos/[id]/action
```

请求体：

```json
{
  "action": "ship",
  "comment": "仓库已确认"
}
```

权限：

- 必须登录。
- 必须是 `admin` 或 `operator`。

行为：

- 校验待办是否存在。
- 校验当前状态是否允许该动作。
- 执行动作对应的工作流流转。
- 同步业务实体状态。
- 返回更新后的待办列表摘要或当前待办结果。

错误处理：

- 未登录：返回现有认证错误响应。
- 无权限：返回现有权限错误响应。
- 待办不存在：返回 404。
- 动作不允许或状态已变化：返回 400，并给出明确错误信息。

## 8. 服务层设计

新增 `src/server/operations/todos.ts`。

职责：

- `listOpsTodos(filters)`: 聚合订单、退款、商品待办。
- `performOpsTodoAction(input)`: 执行卡片动作。
- `buildOrderTodo(...)`: 把订单工作流实例转换成 `OpsTodo`。
- `buildRefundTodo(...)`: 把退款工作流实例转换成 `OpsTodo`。
- `buildProductTodo(...)`: 把待审商品转换成 `OpsTodo`。

服务层要隐藏 Prisma 查询细节和工作流细节，前端和 API route 不直接拼待办卡片。

动作执行要优先使用事务，保证工作流状态与业务状态一起成功或一起失败。商品无工作流实例的兼容动作可以只更新商品状态。

## 9. 前端设计

改造 `/dashboard` 为运营工作台。

页面结构：

- 顶部标题：运营工作台。
- 统计区：
  - 待处理总数。
  - 订单待处理数。
  - 退款待处理数。
  - 商品待审核数。
- 工具栏：
  - 类型筛选：全部、订单、退款、商品审核。
  - 状态筛选。
  - 搜索输入。
- 内容区：
  - 待办卡片列表。
  - 每张卡显示类型、标题、状态、顾客、金额、创建时间和可用动作。
- 状态：
  - 加载中。
  - 空状态。
  - API 错误状态。
  - 操作中按钮禁用。

交互：

- 点击动作按钮后调用 `POST /api/ops/todos/[id]/action`。
- 操作成功后刷新待办列表并显示 toast。
- 操作失败时显示错误 toast。
- 搜索和筛选通过 query key 驱动 React Query 刷新。

## 10. 权限设计

- `/dashboard` 页面继续作为后台入口。
- API 统一使用 `requireStaff()`。
- `customer` 访问 API 时返回权限错误。
- 前端隐藏不该出现的后台入口只是体验优化，不能替代服务端校验。

第一版不区分 `admin` 和 `operator` 的操作范围。后续如果要更贴近商用审批，可以把退款经理审批和商品最终上架限制为 `admin`。

## 11. 测试设计

新增测试覆盖：

- 待办构建：
  - paid 订单会生成“确认发货”动作。
  - pending_payment 订单不会计入运营待办。
  - pending 商品会生成“上架”和“驳回”动作。
  - 退款不同节点会生成对应审核动作。
- 动作执行：
  - 订单 `ship` 会推进工作流并更新 `Order.status`。
  - 退款最终通过会更新 `Refund.status = "approved"` 和 `Order.status = "refunded"`。
  - 退款驳回会更新 `Refund.status = "rejected"`。
  - 商品通过会更新 `Product.status = "published"`。
  - 非法动作会返回错误。
- API 权限：
  - 未登录不可查询待办。
  - `customer` 不可查询待办。
  - `operator` 可以查询和处理待办。

保持以下命令通过：

```bash
npm run test
npm run typecheck
npm run lint
npm run build
```

## 12. 验收标准

- `/dashboard` 展示运营工作台，而不是原来的简单工作流列表。
- 工作台能看到订单、退款、商品审核三类待办的统计和卡片。
- 工作台支持按类型和搜索文本过滤。
- 订单“确认发货”会同步更新订单状态和工作流状态。
- 退款通过或驳回会同步更新退款状态和工作流状态。
- 商品上架或驳回会同步更新商品状态。
- `customer` 无法访问运营待办 API。
- 测试、类型检查、lint 和构建通过。

## 13. 风险与约束

- 当前本机仍没有可用 Docker/PostgreSQL 环境，真实连库验证可能需要在安装 Docker 后补跑。
- 当前种子数据中的中文显示在部分 PowerShell 输出中可能出现编码显示异常，但源码文件本身按 UTF-8 维护。
- 本阶段不新增数据库结构，旧数据里没有商品审核工作流实例时，会采用兼容路径直接处理待审商品。
- 如果后续要把商品审核全量纳入工作流，需要在商品提交审核时自动创建 `product_approval` 实例。
