import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { validateRegisterInput } from "@/server/auth/register";

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
            const name = String(formData.get("name") ?? "");
            const email = String(formData.get("email") ?? "");
            const password = String(formData.get("password") ?? "");

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
            <Input id="password" name="password" type="password" placeholder="至少 6 位" required minLength={6} />
          </div>
          {sp?.error && <p className="text-sm text-red-500">{sp.error}</p>}
          <Button type="submit" className="w-full">注册</Button>
          <p className="text-center text-sm text-gray-500">
            已有账号？<Link href="/login" className="underline">去登录</Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
