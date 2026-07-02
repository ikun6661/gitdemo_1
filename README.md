# EcomFlow

AI 电商练习项目，当前基线使用 Next.js、Prisma、PostgreSQL、NextAuth 和 Vitest。

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

## 常用命令

```bash
npm run test
npm run lint
npm run build
npm run prisma:generate
```

如果本机没有 Docker 或 PostgreSQL，`prisma:migrate` 和 `prisma:seed` 会无法连接 `localhost:5432`。先安装并启动 Docker Desktop，或改用可访问的 PostgreSQL 连接字符串。
