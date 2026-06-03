import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const sp = await searchParams;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-center text-2xl">注册 EcomFlow</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          action={async (formData: FormData) => {
            "use server";
            const name = formData.get("name") as string;
            const email = formData.get("email") as string;
            const password = formData.get("password") as string;

            if (!name || !email || !password) {
              redirect("/register?error=missing");
            }

            const existing = await prisma.user.findUnique({ where: { email } });
            if (existing) {
              redirect("/register?error=exists");
            }

            const passwordHash = await bcrypt.hash(password, 10);
            await prisma.user.create({
              data: { name, email, passwordHash, role: "customer" },
            });

            redirect("/login");
          }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="name">姓名</Label>
            <Input id="name" name="name" placeholder="张三" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">邮箱</Label>
            <Input id="email" name="email" type="email" placeholder="zhangsan@example.com" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">密码</Label>
            <Input id="password" name="password" type="password" placeholder="至少6位" required minLength={6} />
          </div>
          {sp?.error === "exists" && (
            <p className="text-sm text-red-500">该邮箱已被注册</p>
          )}
          {sp?.error === "missing" && (
            <p className="text-sm text-red-500">请填写所有必填字段</p>
          )}
          <Button type="submit" className="w-full">注册</Button>
          <p className="text-center text-sm text-gray-500">
            已有账号？<Link href="/login" className="underline">去登录</Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
