"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

interface Instance {
  id: string; currentNode: string; status: string; targetType: string; targetId: string;
  context: any; workflow: { name: string; nodes: any[]; edges: any[] };
  logs: { toNode: string; action: string; createdAt: string }[];
}

const nodeColors: Record<string, string> = {
  pending_payment: "bg-yellow-100 text-yellow-800",
  paid: "bg-blue-100 text-blue-800",
  shipped: "bg-green-100 text-green-800",
  received: "bg-purple-100 text-purple-800",
  completed: "bg-gray-100 text-gray-800",
  cancelled: "bg-red-100 text-red-800",
  refunding: "bg-orange-100 text-orange-800",
  refunded: "bg-pink-100 text-pink-800",
  pending_review: "bg-yellow-100 text-yellow-800",
  cs_review: "bg-blue-100 text-blue-800",
  manager_approval: "bg-indigo-100 text-indigo-800",
  approved: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
  draft: "bg-gray-100 text-gray-800",
  published: "bg-green-100 text-green-800",
};

export default function DashboardPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("order_flow");

  const { data: orderData, isLoading: orderLoading } = useQuery({
    queryKey: ["instances", "order_flow"],
    queryFn: () => fetch("/api/workflows/instances?workflowType=order_flow").then((r) => r.json()),
    refetchInterval: 5000,
  });

  const { data: approvalData, isLoading: approvalLoading } = useQuery({
    queryKey: ["instances", "approval"],
    queryFn: () => fetch("/api/workflows/instances?targetType=refund").then((r) => r.json()),
    refetchInterval: 5000,
  });

  const transitionMutation = useMutation({
    mutationFn: ({ id, trigger }: { id: string; trigger: string }) =>
      fetch(`/api/workflows/instances/${id}/transition`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ trigger }) }).then((r) => r.json()),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["instances"] }); toast.success("操作成功"); },
    onError: (e: any) => toast.error(e.message || "操作失败"),
  });

  function nextTrigger(instance: Instance): { label: string; trigger: string } | null {
    const edges = instance.workflow.edges as any[];
    const available = edges.filter((e: any) => e.from === instance.currentNode);
    if (available.length === 0) return null;
    return { label: available[0].label, trigger: available[0].trigger };
  }

  function renderInstances(data: any) {
    if (!data?.instances?.length) return <p className="text-gray-500 text-center py-8">暂无数据</p>;
    return (
      <div className="grid gap-4">
        {data.instances.map((inst: Instance) => {
          const next = nextTrigger(inst);
          const nodes = inst.workflow.nodes as any[];
          const doneNodes = inst.logs.map((l) => l.toNode);
          const currentNodeLabel = nodes.find((n) => n.key === inst.currentNode)?.label ?? inst.currentNode;
          return (
            <Card key={inst.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <span className="font-bold text-lg">{inst.workflow.name}</span>
                    {inst.context?.orderNo && <span className="ml-3 text-sm text-gray-500">{inst.context.orderNo as string}</span>}
                  </div>
                  <Badge className={nodeColors[inst.currentNode] ?? "bg-gray-100"}>{currentNodeLabel}</Badge>
                </div>
                <div className="flex items-center gap-1 mb-3 flex-wrap">
                  {nodes.map((node: any, idx: number) => {
                    const isDone = doneNodes.includes(node.key);
                    const isCurrent = node.key === inst.currentNode;
                    return (
                      <div key={node.key} className="flex items-center gap-1">
                        {idx > 0 && <span className="text-gray-300 text-xs">→</span>}
                        <span className={`text-xs px-2 py-0.5 rounded-full ${isCurrent ? "font-bold ring-2 ring-blue-400 bg-blue-50" : isDone ? "bg-green-50 text-green-600" : "bg-gray-50 text-gray-400"}`}>
                          {isDone ? "✓ " : ""}{isCurrent ? "● " : ""}{node.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
                {next && inst.status === "running" && (
                  <Button size="sm" onClick={() => transitionMutation.mutate({ id: inst.id, trigger: next.trigger })} disabled={transitionMutation.isPending}>
                    {next.label}
                  </Button>
                )}
                {inst.status === "completed" && <Badge variant="outline" className="text-green-600">已完成</Badge>}
              </CardContent>
            </Card>
          );
        })}
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">流程看板</h1>
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="order_flow">订单流程</TabsTrigger>
          <TabsTrigger value="approval">审批流程</TabsTrigger>
        </TabsList>
        <TabsContent value="order_flow" className="mt-4">
          {orderLoading ? <p>加载中...</p> : renderInstances(orderData)}
        </TabsContent>
        <TabsContent value="approval" className="mt-4">
          {approvalLoading ? <p>加载中...</p> : renderInstances(approvalData)}
        </TabsContent>
      </Tabs>
    </div>
  );
}
