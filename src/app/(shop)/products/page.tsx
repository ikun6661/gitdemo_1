"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface Product {
  id: string;
  name: string;
  price: number;
  images: string[];
  category: { name: string };
}

// 商品列表页
export default function ProductsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["products"],
    queryFn: () => fetch("/api/products").then((r) => r.json()),
  });

  if (isLoading)
    return <div className="text-center py-12">加载中...</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">商品列表</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {(data?.products as Product[])?.map((p) => (
          <Card key={p.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="aspect-square bg-gray-100 rounded-md mb-3 flex items-center justify-center text-gray-400">
                <span>暂无图片</span>
              </div>
              <h3 className="font-medium truncate">{p.name}</h3>
              <p className="text-sm text-gray-500 mb-2">{p.category?.name}</p>
              <div className="flex items-center justify-between">
                <span className="text-lg font-bold text-red-500">
                  ¥{(p.price / 100).toFixed(2)}
                </span>
                <Link href={`/products/${p.id}`}>
                  <Button size="sm" variant="outline">
                    查看
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
