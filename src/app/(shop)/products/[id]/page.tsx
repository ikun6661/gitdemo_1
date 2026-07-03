"use client";

import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

// 商品详情页
export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();

  const { data: product, isLoading } = useQuery({
    queryKey: ["product", id],
    queryFn: () => fetch(`/api/products/${id}`).then((r) => r.json()),
  });

  const addToCart = useMutation({
    mutationFn: () =>
      fetch("/api/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: id, quantity: 1 }),
      }).then((r) => {
        if (!r.ok) throw new Error("添加失败");
        return r.json();
      }),
    onSuccess: () => toast.success("已加入购物车"),
    onError: () => toast.error("添加失败，请登录后再试"),
  });

  if (isLoading)
    return <div className="text-center py-12">加载中...</div>;
  if (!product || product.error)
    return <div className="text-center py-12">商品不存在</div>;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="aspect-square bg-gray-100 rounded-lg flex items-center justify-center text-gray-400">
          商品图片
        </div>
        <div>
          <h1 className="text-2xl font-bold mb-2">{product.name}</h1>
          <p className="text-gray-500 mb-4">{product.description}</p>
          <p className="text-3xl font-bold text-red-500 mb-4">
            ¥{(product.price / 100).toFixed(2)}
          </p>
          <p className="text-sm text-gray-500 mb-2">库存: {product.stock}</p>
          <p className="text-sm text-gray-500 mb-6">
            分类: {product.category?.name}
          </p>
          <div className="flex gap-3">
            <Button
              size="lg"
              onClick={() => addToCart.mutate()}
              disabled={product.stock === 0}
            >
              {product.stock === 0 ? "已售罄" : "加入购物车"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
