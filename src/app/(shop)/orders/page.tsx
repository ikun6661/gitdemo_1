"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

// 订单状态中文映射
const statusMap: Record<string, string> = {
  pending_payment: "待支付",
  paid: "已支付",
  shipped: "已发货",
  received: "已收货",
  completed: "已完成",
  cancelled: "已取消",
  refunding: "退款中",
  refunded: "已退款",
};

interface OrderItemView {
  id: string;
  quantity: number;
  unitPrice: number;
  product: {
    name: string;
  };
}

interface OrderView {
  id: string;
  orderNo: string;
  totalAmount: number;
  status: string;
  createdAt: string;
  items: OrderItemView[];
}

// 我的订单页
export default function OrdersPage() {
  const { data: orders, isLoading } = useQuery({
    queryKey: ["my-orders"],
    queryFn: () => fetch("/api/orders").then((r) => r.json()),
  });

  if (isLoading)
    return <div className="text-center py-12">加载中...</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">我的订单</h1>
      {!orders || orders.length === 0 ? (
        <p className="text-gray-500 text-center py-8">暂无订单</p>
      ) : (
        <div className="space-y-4">
          {(orders as OrderView[]).map((order) => (
            <Card key={order.id}>
              <CardContent className="p-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-bold">{order.orderNo}</span>
                  <Badge>{statusMap[order.status] || order.status}</Badge>
                </div>
                <p className="text-lg font-bold text-red-500">
                  ¥{(order.totalAmount / 100).toFixed(2)}
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  {order.items?.length || 0} 件商品
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  {new Date(order.createdAt).toLocaleString("zh-CN")}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
