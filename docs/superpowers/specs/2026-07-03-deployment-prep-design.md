# EcomFlow 部署准备设计

## 目标

让 EcomFlow 可以从 GitHub 拉取代码后部署到一台普通云服务器上运行。部署方式采用 Docker Compose 单机方案，覆盖应用容器、PostgreSQL 数据库、生产环境变量、数据库迁移和基础运维命令。

## 非目标

- 不接入 Kubernetes、复杂 CI/CD 或多服务器编排。
- 不在仓库中保存真实生产密钥。
- 不在本阶段配置域名、HTTPS、Nginx 反向代理或云数据库托管。
- 不把 AI 文案生成接入真实 OpenAI API，只保留环境变量预留。

## 推荐部署形态

采用一台服务器运行两个核心服务：

- `app`：Next.js 生产构建后的应用服务，监听容器内 `3000` 端口。
- `postgres`：PostgreSQL 16，使用 Docker volume 持久化数据。

服务器上通过下面的命令启动：

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

这种方式适合当前练习项目，因为它能用最少组件形成真实部署闭环：代码构建、环境变量、数据库、迁移、启动、日志和重启。

## 环境变量设计

保留现有 `.env.example` 作为本地开发示例，新增 `.env.production.example` 作为服务器部署模板。

生产模板包含：

```env
DATABASE_URL="postgresql://ecomflow:change-me@postgres:5432/ecomflow"
AUTH_SECRET="replace-with-a-long-random-secret"
AUTH_URL="http://your-server-ip:3000"
NEXTAUTH_SECRET="replace-with-a-long-random-secret"
NEXTAUTH_URL="http://your-server-ip:3000"
OPENAI_API_KEY=""
POSTGRES_USER="ecomflow"
POSTGRES_PASSWORD="change-me"
POSTGRES_DB="ecomflow"
```

规则：

- `.env.production` 只在服务器上创建，不提交。
- `AUTH_SECRET` 和 `NEXTAUTH_SECRET` 使用同一个长随机值即可。
- 如果未来绑定域名，`AUTH_URL` 和 `NEXTAUTH_URL` 从服务器 IP 改为正式域名。
- `DATABASE_URL` 在 Docker Compose 内部使用服务名 `postgres`，不是 `localhost`。

## Dockerfile 设计

新增 `Dockerfile`，使用 Node 运行时构建和启动 Next.js。

构建流程：

1. 安装依赖。
2. 生成 Prisma Client。
3. 执行 `npm run build`。
4. 生产容器运行 `npm run start`。

约束：

- 不把 `.env.production` COPY 进镜像。
- 依赖安装和构建在镜像内完成，保证服务器不需要手动 `npm install`。
- 使用 `.dockerignore` 排除 `node_modules`、`.next`、`.env*` 和 worktree 目录，避免镜像过大或泄露本地文件。

## Docker Compose 设计

新增 `docker-compose.prod.yml`：

- `postgres` 使用 `postgres:16-alpine`。
- `postgres` 使用 `pgdata_prod` volume 持久化。
- `app` 从本仓库 Dockerfile 构建。
- `app` 读取 `.env.production`。
- `app` 依赖 `postgres`。
- `app` 暴露 `3000:3000`。

数据库迁移不自动塞进 `app` 启动命令里。生产部署时先显式执行迁移：

```bash
docker compose -f docker-compose.prod.yml run --rm app npm run prisma:deploy
```

这样做更接近商用流程：启动应用和修改数据库结构是两个可观察、可回滚意识更强的步骤。

## npm 脚本设计

新增脚本：

```json
{
  "prisma:deploy": "prisma migrate deploy",
  "deploy:build": "docker compose -f docker-compose.prod.yml build",
  "deploy:up": "docker compose -f docker-compose.prod.yml up -d",
  "deploy:down": "docker compose -f docker-compose.prod.yml down",
  "deploy:logs": "docker compose -f docker-compose.prod.yml logs -f app"
}
```

这些脚本是便捷入口，README 仍然写出完整 Docker Compose 命令，方便小白理解底层发生了什么。

## README 部署说明

README 新增“服务器部署”章节，包含：

1. 安装 Docker 和 Docker Compose 插件。
2. 从 GitHub 克隆仓库。
3. 复制 `.env.production.example` 为 `.env.production`。
4. 修改生产环境变量。
5. 构建镜像。
6. 启动 PostgreSQL 和 app。
7. 执行 Prisma 迁移。
8. 如需演示数据，执行 seed。
9. 查看日志和访问地址。

README 需要明确两点：

- 首次部署建议先跑迁移，再决定是否 seed。
- `prisma:seed` 会写入演示账号和商品数据，不应在已有真实数据的生产库里随意反复执行。

## 错误处理和运维约定

部署文档提供常见检查命令：

```bash
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f app
docker compose -f docker-compose.prod.yml logs -f postgres
docker compose -f docker-compose.prod.yml exec postgres pg_isready -U ecomflow -d ecomflow
```

如果应用无法登录或回调异常，优先检查：

- `AUTH_URL`
- `NEXTAUTH_URL`
- `AUTH_SECRET`
- `NEXTAUTH_SECRET`

如果数据库连接失败，优先检查：

- `POSTGRES_PASSWORD`
- `DATABASE_URL`
- `postgres` 服务是否 healthy

## 测试和验收

实现完成后必须通过：

```bash
npm run test
npm run typecheck
npm run lint
npx prisma validate
npm run build
docker compose -f docker-compose.prod.yml config
docker build -t ecomflow-deploy-check .
```

如果本机没有 Docker，则 Docker 相关命令记录为环境限制，但代码和文档仍需完成。

## 后续升级方向

部署准备阶段完成后，下一阶段可以继续做：

- 服务器实际部署演练。
- 域名和 HTTPS。
- GitHub Actions 自动构建和部署。
- PostgreSQL 备份与恢复脚本。
- 生产日志、健康检查和监控。
