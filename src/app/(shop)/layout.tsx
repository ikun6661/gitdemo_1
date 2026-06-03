import { Header } from "@/components/layout/Header";

// 商城布局：顶部导航 + 内容区
export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      <main className="container mx-auto px-4 py-6">{children}</main>
    </>
  );
}
