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

## 服务器部署

推荐先用 Docker Compose 单机部署，适合练习和小型演示环境。

1. 在服务器安装 Docker 和 Docker Compose 插件。

2. 克隆仓库并进入目录：

   ```bash
   git clone https://github.com/ikun6661/gitdemo_1.git
   cd gitdemo_1
   ```

3. 创建生产环境变量：

   ```bash
   cp .env.production.example .env.production
   ```

   Windows PowerShell 可以使用：

   ```powershell
   Copy-Item .env.production.example .env.production
   ```

4. 编辑 `.env.production`：

   - 把 `POSTGRES_PASSWORD` 改成强密码。
   - 保持 `DATABASE_URL` 中的密码和 `POSTGRES_PASSWORD` 一致。
   - 把 `AUTH_SECRET` 和 `NEXTAUTH_SECRET` 改成长随机字符串。
   - 把 `AUTH_URL` 和 `NEXTAUTH_URL` 改成服务器访问地址，例如 `http://服务器IP:3000`。

5. 构建镜像：

   ```bash
   docker compose -f docker-compose.prod.yml --env-file .env.production build
   ```

6. 启动数据库和应用：

   ```bash
   docker compose -f docker-compose.prod.yml --env-file .env.production up -d
   ```

7. 执行数据库迁移：

   ```bash
   docker compose -f docker-compose.prod.yml --env-file .env.production run --rm app npm run prisma:deploy
   ```

8. 如需演示数据，执行 seed：

   ```bash
   docker compose -f docker-compose.prod.yml --env-file .env.production run --rm app npm run prisma:seed
   ```

   `prisma:seed` 会写入演示账号、商品和工作流模板，不要在已有真实业务数据的生产库里随意反复执行。

9. 访问：

   ```text
   http://服务器IP:3000
   ```

### 常用部署命令

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production ps
docker compose -f docker-compose.prod.yml --env-file .env.production logs -f app
docker compose -f docker-compose.prod.yml --env-file .env.production logs -f postgres
docker compose -f docker-compose.prod.yml --env-file .env.production exec postgres pg_isready -U ecomflow -d ecomflow
docker compose -f docker-compose.prod.yml --env-file .env.production down
```

如果登录回调异常，优先检查 `AUTH_URL`、`NEXTAUTH_URL`、`AUTH_SECRET`、`NEXTAUTH_SECRET`。

如果数据库连接失败，优先检查 `POSTGRES_PASSWORD`、`DATABASE_URL` 和 `postgres` 服务状态。

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
