# EcomFlow — 电商工作流引擎设计文档

## 元信息

- **日期**: 2026-06-03
- **状态**: 已确认
- **技术栈**: Next.js 14 + TypeScript + Prisma + PostgreSQL + Redis + Tailwind CSS + shadcn/ui

---

## 1. 项目概述

构建一个全栈电商工作流管理系统，核心是一个**通用轻量状态机引擎**，统一驱动两类业务场景：

- **订单全链路**：下单 → 支付 → 发货 → 收货 → 完成（带取消/退款分支）
- **审批工作流**：退款审批（客服→经理）、商品上架审批（运营→管理员）

前端提供两个主要界面：
- **流程看板**：日常运营用，Tab 切换订单/审批，展示所有运行中的实例
- **演示模式**：向客户展示用，分步手动推进，带流程可视化和动画过渡
- **管理后台**：商品 CRUD、用户管理（支撑性功能）

---

## 2. 架构设计

### 2.1 整体分层

```
前端层 (React + Tailwind + shadcn/ui)
  ├── 流程看板 (日常运营)
  ├── 演示模式 (客户展示)
  ├── 管理后台 (商品/用户 CRUD)
  └── 登录注册 (NextAuth.js)

  ↕ tRPC (端到端类型安全)

后端层 (Next.js API Routes)
  ├── 工作流引擎 (核心)
  ├── 商品服务
  ├── 订单服务
  └── 审批服务

  ↕ Prisma ORM

数据层
  ├── PostgreSQL (主库)
  └── Redis (会话/缓存，预留队列)
```

### 2.2 关键设计决策

| 决策 | 选择 | 理由 |
|------|------|------|
| 工作流架构 | 轻量状态机（方案 A） | 统一引擎，易扩展，演示友好 |
| 流程配置 | 先硬编码，预留扩展点 | 快速上线，nodes/edges JSON 字段为后续配置化留空间 |
| 演示模式 | 分步手动推进 | 适合边演示边讲解 |
| 数据方案 | 预置种子数据 | 开箱即用，演示场景直接用 |
| 全栈方案 | Next.js 单体应用 | 前后端一体，部署简单 |

---

## 3. 数据模型

### 3.1 工作流引擎（3 张核心表）

```
workflows                流程模板
├── id
├── name                 模板名称（如 "订单全链路"）
├── type                 类型（order / approval）
├── nodes                JSON: 节点定义 [{key, label, actions, conditions}]
├── edges                JSON: 流转规则 [{from, to, trigger, guard}]
└── created_at

workflow_instances       流程实例
├── id
├── workflow_id          关联模板
├── current_node         当前所处节点
├── status               running / completed / cancelled
├── target_type          关联业务类型（order / refund / product）
├── target_id            关联业务 ID
├── context              JSON: 运行时上下文数据
├── started_at / ended_at
└── created_at

workflow_logs            流转日志
├── id
├── instance_id          关联实例
├── from_node / to_node  流转路径
├── operator             操作人
├── action               操作类型
├── comment              备注
├── metadata             JSON
└── created_at
```

**多态关联说明**：`target_type` + `target_id` 让一套引擎同时关联 orders、refunds、products 等不同业务表。

### 3.2 业务表（7 张）

```
categories              商品分类
├── id, name, slug, parent_id (自引用), created_at

products                商品
├── id, name, description, price, stock
├── images (JSON), category_id
├── status: draft | pending | published
└── created_at, updated_at

users                   用户
├── id, name, email, password_hash
├── role: admin | operator | customer
└── created_at, updated_at

orders                  订单
├── id, order_no, user_id
├── total_amount, address (JSON)
├── status (由工作流引擎驱动)
└── created_at, updated_at

order_items             订单明细
├── id, order_id, product_id
├── quantity, unit_price
└── snapshot (JSON, 下单时的商品快照)

refunds                 退款单
├── id, order_id, user_id
├── reason, amount
├── status (由工作流引擎驱动)
└── created_at, updated_at
```

总共 **10 张表**（引擎 3 张 + 业务 7 张）。

---

## 4. 预置工作流模板

### 4.1 订单全链路

```
待支付 → 已支付 → 已发货 → 已收货 → 已完成
  ↓         ↓        ↓        ↓
  └─────── 已取消 ─────────────┘
  ↓         ↓
  └── 退款中 → 已退款
```

- **待支付**：订单创建，等待用户付款
- **已支付**：付款成功，等待商家发货
- **已发货**：商家录入物流，等待用户收货
- **已收货**：用户确认收货
- **已完成**：订单终结
- **已取消**：任意节点可取消（超时/用户主动）
- **退款中 → 已退款**：已发货后也可走退款流程

### 4.2 退款审批

```
待审核 → 客服审核 → 经理审批 → 已通过
  ↓         ↓         ↓
  └─────── 已驳回 ──────┘
```

### 4.3 商品上架审批

```
草稿 → 待审核 → 已上架
  ↓      ↓
  └── 已驳回
```

---

## 5. 前端页面设计

### 5.1 流程看板（/dashboard）

- **Tab 切换**：订单流程 | 审批流程
- **卡牌列表**：每个运行中的实例一张卡牌，显示：
  - 关联业务信息（订单号/退款单号、金额、用户）
  - 流程进度条（已完成节点 ✓、当前节点 ●、未达节点 ○）
  - 下一步操作按钮
- **筛选**：按状态、时间范围过滤
- **权限**：admin 看全部，operator 看自己相关的

### 5.2 演示模式（/demo）

- **场景切换**：下拉选择三个预置场景
- **左右分栏**：
  - 左侧：流程步骤进度条（垂直时间线）
  - 右侧：当前节点详情 + 业务数据 + "下一步"按钮
- **分步推进**：每次点击触发动画（节点高亮→进度推进→内容刷新）
- **数据隔离**：演示数据带 DEMO 前缀，独立于正式数据
- **重置按钮**：一键恢复到初始状态

### 5.3 管理后台（/admin）

- 商品管理：列表、新建、编辑、删除
- 用户管理：列表、角色分配
- 订单列表：只读查看（状态由引擎驱动）

### 5.4 登录注册（/login, /register）

- NextAuth.js 邮箱密码登录
- 角色：admin、operator、customer

---

## 6. API 设计（概要）

### 工作流引擎 API

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/workflows/:id/start | 启动一个工作流实例 |
| POST | /api/workflows/instances/:id/transition | 推进到下一节点 |
| GET | /api/workflows/instances | 查询实例列表（支持筛选） |
| GET | /api/workflows/instances/:id | 查询实例详情+日志 |

### 业务 API

| 方法 | 路径 | 说明 |
|------|------|------|
| CRUD | /api/products | 商品管理 |
| CRUD | /api/users | 用户管理 |
| CRUD | /api/orders | 订单管理 |
| CRUD | /api/refunds | 退款管理 |

### 演示 API

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/demo/reset | 重置演示数据 |
| POST | /api/demo/scenarios/:id/step | 推进演示场景一步 |

---

## 7. 种子数据

系统启动时自动播种：

- **3 个角色用户**：admin@ecomflow.com / operator@ecomflow.com / customer@ecomflow.com（密码统一 `demo123456`）
- **1 个分类**：电子产品
- **5 个商品**：iPhone 15、MacBook Air、AirPods Pro、iPad、Apple Watch
- **3 个演示场景**：标准订单、退款审批、商品上架审批

---

## 8. 非功能性需求

| 类别 | 要求 |
|------|------|
| 性能 | 页面首屏 < 2s，API 响应 < 300ms |
| 安全 | NextAuth.js 认证，CSRF 防护，输入校验 |
| 代码质量 | TypeScript strict 模式，ESLint + Prettier |
| 可维护性 | 模块化分层，工作流引擎独立可测试 |

---

## 9. 不在本期范围

- 真实支付对接（演示用模拟支付）
- 物流 API 对接（演示用模拟物流）
- 可视化流程编辑器
- 多仓库、多商户
- 消息通知（短信/邮件）
- 数据报表/大屏
- 积分/优惠券/营销

---

## 10. 开发顺序（一期）

| 阶段 | 内容 | 预估 |
|------|------|------|
| 1 | 项目脚手架 + 数据库 + 种子数据 | 初始化 |
| 2 | 工作流引擎核心（3张表 + 核心逻辑） | 核心 |
| 3 | 用户认证（NextAuth.js） | 基础 |
| 4 | 商品 + 用户管理后台 | 基础 |
| 5 | 订单服务 + 引擎对接 | 核心 |
| 6 | 退款审批 + 引擎对接 | 核心 |
| 7 | 流程看板页面 | 前端 |
| 8 | 演示模式页面 | 前端 |
| 9 | 联调 + 验收 | 收尾 |
