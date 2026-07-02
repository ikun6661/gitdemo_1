import Link from "next/link";
import { auth, signOut } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { isStaffRole } from "@/types/auth";

export async function Header() {
  const session = await auth();
  const user = session?.user;

  return (
    <header className="border-b bg-white">
      <div className="container mx-auto flex h-14 items-center justify-between px-4">
        <Link href="/" className="text-lg font-bold">EcomFlow</Link>
        <nav className="flex items-center gap-4">
          {user ? (
            <>
              <Link href="/products" className="text-sm hover:underline">商品</Link>
              {isStaffRole(user.role) && (
                <>
                  <Link href="/dashboard" className="text-sm hover:underline">看板</Link>
                  <Link href="/demo" className="text-sm hover:underline">演示</Link>
                </>
              )}
              {user.role === "admin" && (
                <Link href="/admin/products" className="text-sm hover:underline">管理</Link>
              )}
              <span className="text-sm text-gray-500">{user.name}</span>
              <form action={async () => { "use server"; await signOut({ redirectTo: "/login" }); }}>
                <Button variant="outline" size="sm" type="submit">退出</Button>
              </form>
            </>
          ) : (
            <Link href="/login"><Button variant="outline" size="sm">登录</Button></Link>
          )}
        </nav>
      </div>
    </header>
  );
}
