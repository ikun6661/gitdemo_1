import Link from "next/link";
import { Card } from "@/components/ui/card";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="container mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold mb-6">管理后台</h1>
      <div className="flex gap-6">
        <nav className="w-48 shrink-0">
          <Card className="p-2">
            <Link href="/admin/products" className="block px-3 py-2 rounded-md text-sm hover:bg-gray-100">商品管理</Link>
            <Link href="/admin/users" className="block px-3 py-2 rounded-md text-sm hover:bg-gray-100">用户管理</Link>
          </Card>
        </nav>
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
