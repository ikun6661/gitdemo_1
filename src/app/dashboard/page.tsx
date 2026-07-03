"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

type OpsTodoAction = {
  key: string;
  label: string;
  variant: "default" | "outline" | "destructive";
  requiresComment?: boolean;
};

type OpsTodo = {
  id: string;
  type: "order" | "refund" | "product";
  title: string;
  subtitle: string;
  status: string;
  statusLabel: string;
  statusTone: "yellow" | "blue" | "green" | "red" | "gray" | "orange";
  targetId: string;
  workflowInstanceId?: string;
  amount?: number;
  customerName?: string;
  createdAt: string;
  actions: OpsTodoAction[];
};

type OpsTodoSummary = {
  total: number;
  orders: number;
  refunds: number;
  products: number;
};

type OpsTodoListResponse = {
  summary: OpsTodoSummary;
  todos: OpsTodo[];
};

type TodoTypeFilter = "all" | OpsTodo["type"];
type TodoStatusFilter =
  | "all"
  | "paid"
  | "pending_review"
  | "cs_review"
  | "manager_approval"
  | "pending";

const typeOptions: Array<{ value: TodoTypeFilter; label: string }> = [
  { value: "all", label: "全部" },
  { value: "order", label: "订单" },
  { value: "refund", label: "退款" },
  { value: "product", label: "商品审核" },
];

const statusOptions: Array<{ value: TodoStatusFilter; label: string }> = [
  { value: "all", label: "全部状态" },
  { value: "paid", label: "已支付" },
  { value: "pending_review", label: "待初审" },
  { value: "cs_review", label: "客服审核" },
  { value: "manager_approval", label: "经理审批" },
  { value: "pending", label: "商品待审核" },
];

const typeLabels: Record<OpsTodo["type"], string> = {
  order: "订单",
  refund: "退款",
  product: "商品审核",
};

const statusLabels: Record<string, string> = {
  paid: "已支付",
  pending_review: "待初审",
  cs_review: "客服审核",
  manager_approval: "经理审批",
  pending: "商品待审核",
};

const typeClasses: Record<OpsTodo["type"], string> = {
  order: "border-sky-200 bg-sky-50 text-sky-700",
  refund: "border-rose-200 bg-rose-50 text-rose-700",
  product: "border-emerald-200 bg-emerald-50 text-emerald-700",
};

const toneClasses: Record<OpsTodo["statusTone"], string> = {
  yellow: "border-yellow-200 bg-yellow-50 text-yellow-800",
  blue: "border-blue-200 bg-blue-50 text-blue-700",
  green: "border-green-200 bg-green-50 text-green-700",
  red: "border-red-200 bg-red-50 text-red-700",
  gray: "border-gray-200 bg-gray-50 text-gray-700",
  orange: "border-orange-200 bg-orange-50 text-orange-700",
};

const emptySummary: OpsTodoSummary = {
  total: 0,
  orders: 0,
  refunds: 0,
  products: 0,
};

function formatMoney(value?: number) {
  if (value === undefined) return "未记录金额";

  return `¥${(value / 100).toFixed(2)}`;
}

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "时间未知";

  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

async function readApiError(response: Response) {
  try {
    const body = (await response.json()) as { error?: string };
    return body.error || "操作失败";
  } catch {
    return "操作失败";
  }
}

async function fetchOpsTodos(
  type: TodoTypeFilter,
  status: TodoStatusFilter,
  search: string,
) {
  const params = new URLSearchParams();
  const trimmedSearch = search.trim();

  if (type !== "all") params.set("type", type);
  if (status !== "all") params.set("status", status);
  if (trimmedSearch.length > 0) params.set("search", trimmedSearch);

  const query = params.toString();
  const response = await fetch(`/api/ops/todos${query ? `?${query}` : ""}`);

  if (!response.ok) {
    throw new Error(await readApiError(response));
  }

  return (await response.json()) as OpsTodoListResponse;
}

function getStatusLabel(todo: OpsTodo) {
  return statusLabels[todo.status] ?? todo.statusLabel ?? todo.status;
}

export default function DashboardPage() {
  const queryClient = useQueryClient();
  const [type, setType] = useState<TodoTypeFilter>("all");
  const [status, setStatus] = useState<TodoStatusFilter>("all");
  const [search, setSearch] = useState("");

  const {
    data,
    error,
    isError,
    isFetching,
    isLoading,
    refetch,
  } = useQuery<OpsTodoListResponse>({
    queryKey: ["ops-todos", type, status, search],
    queryFn: () => fetchOpsTodos(type, status, search),
    refetchInterval: 5000,
  });

  const actionMutation = useMutation({
    mutationFn: async ({
      action,
      todo,
    }: {
      action: OpsTodoAction;
      todo: OpsTodo;
    }) => {
      const response = await fetch(
        `/api/ops/todos/${encodeURIComponent(todo.id)}/action`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: action.key }),
        },
      );

      if (!response.ok) {
        throw new Error(await readApiError(response));
      }

      return response.json() as Promise<{ success: true }>;
    },
    onSuccess: (_result, { action }) => {
      void queryClient.invalidateQueries({ queryKey: ["ops-todos"] });
      toast.success(`${action.label}成功`);
    },
    onError: (mutationError) => {
      toast.error(
        mutationError instanceof Error ? mutationError.message : "操作失败",
      );
    },
  });

  const summary = data?.summary ?? emptySummary;
  const todos = data?.todos ?? [];
  const summaryCards = [
    {
      label: "待处理",
      value: summary.total,
      className: "border-slate-200 bg-slate-50",
    },
    {
      label: "订单待发货",
      value: summary.orders,
      className: "border-sky-200 bg-sky-50",
    },
    {
      label: "退款待审核",
      value: summary.refunds,
      className: "border-rose-200 bg-rose-50",
    },
    {
      label: "商品待审核",
      value: summary.products,
      className: "border-emerald-200 bg-emerald-50",
    },
  ];

  function renderTodoContent() {
    if (isLoading) {
      return (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            加载待办中...
          </CardContent>
        </Card>
      );
    }

    if (isError) {
      return (
        <Card className="border-red-200 bg-red-50/70">
          <CardContent className="space-y-3 p-6">
            <div>
              <p className="font-medium text-red-800">待办加载失败</p>
              <p className="mt-1 text-sm text-red-700">
                {error instanceof Error ? error.message : "请稍后重试"}
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => void refetch()}>
              重试
            </Button>
          </CardContent>
        </Card>
      );
    }

    if (todos.length === 0) {
      return (
        <Card>
          <CardContent className="p-8 text-center">
            <p className="font-medium">暂无待办</p>
            <p className="mt-1 text-sm text-muted-foreground">
              当前筛选条件下没有需要处理的事项。
            </p>
          </CardContent>
        </Card>
      );
    }

    return (
      <div className="space-y-3">
        {todos.map((todo) => (
          <Card key={todo.id} className="overflow-visible">
            <CardContent className="p-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 flex-1 space-y-3">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <Badge
                      variant="outline"
                      className={typeClasses[todo.type]}
                    >
                      {typeLabels[todo.type]}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={toneClasses[todo.statusTone]}
                    >
                      {getStatusLabel(todo)}
                    </Badge>
                    <span>{formatTime(todo.createdAt)}</span>
                  </div>

                  <div className="min-w-0">
                    <h2 className="break-words text-base font-semibold leading-snug">
                      {todo.title}
                    </h2>
                    <p className="mt-1 break-words text-sm text-muted-foreground">
                      {todo.subtitle}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
                    <span className="inline-flex gap-1">
                      <span className="text-muted-foreground">金额</span>
                      <span className="font-medium">
                        {formatMoney(todo.amount)}
                      </span>
                    </span>
                    {todo.customerName && (
                      <span className="inline-flex min-w-0 gap-1">
                        <span className="text-muted-foreground">客户</span>
                        <span className="min-w-0 max-w-48 truncate font-medium">
                          {todo.customerName}
                        </span>
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex w-full flex-wrap gap-2 lg:w-auto lg:max-w-xs lg:justify-end">
                  {todo.actions.length > 0 ? (
                    todo.actions.map((action) => (
                      <Button
                        key={action.key}
                        size="sm"
                        variant={action.variant}
                        disabled={actionMutation.isPending}
                        onClick={() => actionMutation.mutate({ action, todo })}
                        className="h-auto min-h-7 whitespace-normal px-3 py-1.5"
                      >
                        {action.label}
                      </Button>
                    ))
                  ) : (
                    <Badge variant="outline">暂无操作</Badge>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">运营工作台</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            集中处理订单发货、退款审核和商品上架审核。
          </p>
        </div>
        {isFetching && !isLoading && (
          <Badge variant="outline" className="w-fit">
            同步中
          </Badge>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((card) => (
          <Card key={card.label} size="sm" className={card.className}>
            <CardContent>
              <p className="text-sm text-muted-foreground">{card.label}</p>
              <p className="mt-2 text-2xl font-semibold">{card.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="overflow-visible">
        <CardContent className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            {typeOptions.map((option) => (
              <Button
                key={option.value}
                type="button"
                size="sm"
                variant={type === option.value ? "default" : "outline"}
                onClick={() => setType(option.value)}
                className="h-auto min-h-7 whitespace-normal px-3 py-1.5"
              >
                {option.label}
              </Button>
            ))}
          </div>

          <div className="grid gap-2 sm:grid-cols-[180px_minmax(220px,320px)] lg:flex lg:items-center">
            <select
              value={status}
              onChange={(event) =>
                setStatus(event.target.value as TodoStatusFilter)
              }
              className="h-8 w-full min-w-0 rounded-lg border border-input bg-background px-2.5 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="搜索标题、客户、金额..."
              className="w-full"
            />
          </div>
        </CardContent>
      </Card>

      {renderTodoContent()}
    </div>
  );
}
