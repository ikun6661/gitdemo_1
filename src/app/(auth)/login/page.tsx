import { signIn } from "@/lib/auth";
import { CredentialsSignin } from "next-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}) {
  const sp = await searchParams;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-center text-2xl">登录 EcomFlow</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          action={async (formData: FormData) => {
            "use server";
            const email = formData.get("email") as string;
            const password = formData.get("password") as string;
            const callbackUrl = sp?.callbackUrl || "/products";

            try {
              await signIn("credentials", { email, password, redirectTo: callbackUrl });
            } catch (error) {
              if (error instanceof CredentialsSignin) {
                redirect(`/login?error=CredentialsSignin`);
              }
              throw error;
            }
          }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="email">邮箱</Label>
            <Input id="email" name="email" type="email" placeholder="admin@ecomflow.com" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">密码</Label>
            <Input id="password" name="password" type="password" placeholder="demo123456" required />
          </div>
          {sp?.error && (
            <p className="text-sm text-red-500">邮箱或密码错误，请重试</p>
          )}
          <Button type="submit" className="w-full">登录</Button>
          <p className="text-center text-sm text-gray-500">
            还没有账号？<Link href="/register" className="underline">立即注册</Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
