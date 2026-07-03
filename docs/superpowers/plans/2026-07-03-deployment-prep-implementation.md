# EcomFlow Deployment Prep Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make EcomFlow deployable on a single server with Docker Compose, production environment templates, explicit Prisma migration commands, and beginner-friendly deployment documentation.

**Architecture:** Keep local development unchanged while adding a separate production deployment path. The production path uses a `Dockerfile` for the Next.js app and `docker-compose.prod.yml` for app plus PostgreSQL. Database schema changes are applied explicitly with `prisma migrate deploy` before or during deployment operations.

**Tech Stack:** Next.js 16, React 19, Prisma 5, PostgreSQL 16, Docker, Docker Compose, npm scripts.

---

## File Structure

- Create `.env.production.example`: server-side environment variable template.
- Create `.dockerignore`: prevent local dependencies, build outputs, secrets, and worktrees from entering Docker build context.
- Create `Dockerfile`: production app image.
- Create `docker-compose.prod.yml`: production app and PostgreSQL services.
- Modify `package.json`: add deployment scripts.
- Modify `README.md`: add server deployment, migration, seed, logging, and troubleshooting steps.

---

## Task 1: Production Environment Template and npm Scripts

**Files:**
- Create: `.env.production.example`
- Modify: `package.json`

- [ ] **Step 1: Add `.env.production.example`**

Create `.env.production.example` with exactly:

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

- [ ] **Step 2: Add deployment scripts to `package.json`**

Update the `scripts` object to include:

```json
"prisma:deploy": "prisma migrate deploy",
"deploy:build": "docker compose -f docker-compose.prod.yml build",
"deploy:up": "docker compose -f docker-compose.prod.yml up -d",
"deploy:down": "docker compose -f docker-compose.prod.yml down",
"deploy:logs": "docker compose -f docker-compose.prod.yml logs -f app"
```

Keep existing scripts unchanged.

- [ ] **Step 3: Verify package JSON parses**

Run:

```bash
node -e "const p=require('./package.json'); console.log(p.scripts['prisma:deploy'], p.scripts['deploy:up'])"
```

Expected output includes:

```text
prisma migrate deploy docker compose -f docker-compose.prod.yml up -d
```

- [ ] **Step 4: Commit**

```bash
git add .env.production.example package.json package-lock.json
git commit -m "chore: add production environment scripts"
```

---

## Task 2: Docker Production Runtime

**Files:**
- Create: `.dockerignore`
- Create: `Dockerfile`
- Create: `docker-compose.prod.yml`

- [ ] **Step 1: Add `.dockerignore`**

Create `.dockerignore` with:

```dockerignore
.git
.worktrees
node_modules
.next
coverage
.env
.env.*
!.env.example
!.env.production.example
npm-debug.log*
Dockerfile
docker-compose*.yml
```

- [ ] **Step 2: Add `Dockerfile`**

Create `Dockerfile` with:

```dockerfile
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

COPY package.json package-lock.json ./
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/src ./src
COPY --from=builder /app/next.config.ts ./next.config.ts

EXPOSE 3000
CMD ["npm", "run", "start"]
```

- [ ] **Step 3: Add `docker-compose.prod.yml`**

Create `docker-compose.prod.yml` with:

```yaml
services:
  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    env_file:
      - .env.production
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
    volumes:
      - pgdata_prod:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}"]
      interval: 10s
      timeout: 5s
      retries: 5

  app:
    build:
      context: .
      dockerfile: Dockerfile
    restart: unless-stopped
    env_file:
      - .env.production
    ports:
      - "3000:3000"
    depends_on:
      postgres:
        condition: service_healthy

volumes:
  pgdata_prod:
```

- [ ] **Step 4: Validate Compose config**

Run:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production config
```

Expected: exit code 0 and rendered `services` output.

- [ ] **Step 5: Build Docker image**

Run:

```bash
docker build -t ecomflow-deploy-check .
```

Expected: exit code 0.

- [ ] **Step 6: Commit**

```bash
git add .dockerignore Dockerfile docker-compose.prod.yml
git commit -m "chore: add docker production runtime"
```

---

## Task 3: Deployment README

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Add server deployment section**

Add after the local development section and before demo accounts:

```md
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
```

- [ ] **Step 2: Add operations commands**

Add after the server deployment steps:

```md
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
```

- [ ] **Step 3: Verify README text**

Run:

```bash
rg -n "服务器部署|docker-compose.prod.yml|prisma:deploy|AUTH_URL|POSTGRES_PASSWORD" README.md
```

Expected: all terms appear.

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: document server deployment"
```

---

## Task 4: Final Verification

**Files:**
- No code changes expected.

- [ ] **Step 1: Run full project verification**

Run:

```bash
npm run test
npm run typecheck
npm run lint
npx prisma validate
npm run build
```

Expected: all pass.

- [ ] **Step 2: Run Docker verification**

Run:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production config
docker build -t ecomflow-deploy-check .
```

Expected: both pass if Docker is available.

- [ ] **Step 3: Record database environment**

Run:

```powershell
Test-NetConnection -ComputerName localhost -Port 5432 | Format-List ComputerName,TcpTestSucceeded
```

Expected: record actual result. If `False`, note local PostgreSQL is not running.

- [ ] **Step 4: Check git status**

Run:

```bash
git status --short --branch
git log --oneline -8
```

Expected: clean worktree on `deployment-prep`.

---

## Self-Review Checklist

- Spec coverage: environment template, Dockerfile, production compose, npm scripts, README, verification all have tasks.
- Placeholder scan: no TBD/TODO/fill-in placeholders remain.
- Type consistency: `prisma:deploy`, `docker-compose.prod.yml`, `.env.production.example`, and `.env.production` names match across tasks.
- Risk boundary: real secrets are never committed; `.env.production` remains local only.
