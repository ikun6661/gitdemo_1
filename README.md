# EcomFlow

AI 电商练习项目，当前基线使用 Next.js、Prisma、PostgreSQL、NextAuth 和 Vitest。

## 当前能力

- PostgreSQL + Prisma 数据模型包含用户、商品、购物车、订单、支付记录、退款和工作流。
- NextAuth credentials 登录，支持 `customer`、`operator`、`admin` 三类角色。
- 后台入口和关键 API 使用服务端权限校验。
- 商品数据包含 AI 商品运营预留字段，后续可接入真实 AI 文案生成。

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

| 角色 | 邮箱 | 默认入口 |
| --- | --- | --- |
| 管理员 | `admin@ecomflow.com` | `/dashboard` |
| 运营 | `operator@ecomflow.com` | `/dashboard` |
| 顾客 | `customer@ecomflow.com` | `/products` |

## 常用命令

```bash
npm run test
npm run lint
npm run build
npm run prisma:generate
```

如果本机没有 Docker 或 PostgreSQL，`prisma:migrate` 和 `prisma:seed` 会无法连接 `localhost:5432`。先安装并启动 Docker Desktop，或改用可访问的 PostgreSQL 连接字符串。
