"use client";

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface Scenario {
  name: string; description: string;
  steps: { trigger: string; label: string; detail: string }[];
}

interface DemoState {
  instance: { id: string } | null;
  order: { orderNo: string; totalAmount: number } | null;
  stepIndex: number;
  activeScenario: string;
}

export default function DemoPage() {
  const [state, setState] = useState<DemoState>({ instance: null, order: null, stepIndex: 0, activeScenario: "" });

  const { data: scenarios } = useQuery<Record<string, Scenario>>({
    queryKey: ["demo-scenarios"],
    queryFn: () => fetch("/api/demo/scenarios").then((r) => r.json()),
  });

  const startMutation = useMutation({
    mutationFn: (scenario: string) =>
      fetch("/api/demo/scenarios", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ scenario }) }).then((r) => r.json()),
    onSuccess: (data) => { setState((s) => ({ ...s, instance: data.instance, order: data.order, stepIndex: 0, activeScenario: s.activeScenario })); toast.success("场景已启动"); },
    onError: () => toast.error("启动失败"),
  });

  const stepMutation = useMutation({
    mutationFn: () =>
      fetch("/api/demo/step", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ instanceId: state.instance?.id, scenario: state.activeScenario, stepIndex: state.stepIndex }) }).then((r) => r.json()),
    onSuccess: (data) => {
      if (data.isComplete) toast.success("流程完成！");
      setState((s) => ({ ...s, stepIndex: data.stepIndex }));
    },
    onError: (e: any) => toast.error(e.message || "推进失败"),
  });

  const resetMutation = useMutation({
    mutationFn: () => fetch("/api/demo/reset", { method: "POST" }).then((r) => r.json()),
    onSuccess: () => { setState({ instance: null, order: null, stepIndex: 0, activeScenario: "" }); toast.success("已重置"); },
  });

  const scenarioKeys = Object.keys(scenarios ?? {});
  const currentScenario = scenarios?.[state.activeScenario];
  const steps = currentScenario?.steps ?? [];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">演示模式</h1>
        <Button variant="outline" onClick={() => resetMutation.mutate()}>重置</Button>
      </div>

      {!state.instance ? (
        <div className="grid gap-6 max-w-2xl">
          <p className="text-gray-500">选择一个演示场景开始：</p>
          {scenarioKeys.map((key) => (
            <Card key={key} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => { setState((s) => ({ ...s, activeScenario: key })); startMutation.mutate(key); }}>
              <CardContent className="p-6">
                <h3 className="text-lg font-bold mb-2">{scenarios![key].name}</h3>
                <p className="text-gray-500 mb-3">{scenarios![key].description}</p>
                <Badge variant="outline">{scenarios![key].steps.length} 个步骤</Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card>
            <CardContent className="p-6">
              <h3 className="font-bold mb-4">{currentScenario?.name}</h3>
              {state.order && (
                <div className="text-sm text-gray-500 mb-4">
                  <p>订单号: {state.order.orderNo}</p>
                  <p>金额: ¥{(state.order.totalAmount / 100).toFixed(2)}</p>
                </div>
              )}
              <div className="space-y-3">
                {steps.map((step, idx) => {
                  const isDone = idx < state.stepIndex;
                  const isCurrent = idx === state.stepIndex;
                  return (
                    <div key={idx} className="flex items-start gap-3">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 ${isDone ? "bg-green-500 text-white" : isCurrent ? "bg-blue-500 text-white ring-2 ring-blue-300" : "bg-gray-200 text-gray-500"}`}>
                        {isDone ? "✓" : idx + 1}
                      </div>
                      <div>
                        <p className={`text-sm ${isDone ? "text-green-600" : isCurrent ? "font-bold" : "text-gray-400"}`}>{step.label}</p>
                        {isCurrent && <p className="text-xs text-gray-500 mt-1">{step.detail}</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-6">
                {state.stepIndex < steps.length ? (
                  <Button onClick={() => stepMutation.mutate()} disabled={stepMutation.isPending} className="w-full">
                    下一步: {steps[state.stepIndex]?.label}
                  </Button>
                ) : (
                  <Badge className="bg-green-100 text-green-800 text-base px-4 py-2">流程已完成</Badge>
                )}
              </div>
            </CardContent>
          </Card>
          <Card className="lg:col-span-2">
            <CardContent className="p-6">
              <h3 className="font-bold mb-4">流程详情</h3>
              <p className="text-gray-500">
                {state.stepIndex === 0 ? "订单已创建，等待支付。点击左侧按钮推进流程。" :
                  state.stepIndex < steps.length ? `当前步骤: ${steps[state.stepIndex]?.label} - ${steps[state.stepIndex]?.detail}` :
                  "所有步骤已完成！可点击重置按钮重新开始。"}
              </p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
