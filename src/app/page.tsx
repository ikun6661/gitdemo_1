import { redirect } from "next/navigation";

// 首页重定向到商品列表
export default function Home() {
  redirect("/products");
}
