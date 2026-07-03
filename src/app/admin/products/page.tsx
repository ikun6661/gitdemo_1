"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface Product {
  id: string; name: string; description: string; price: number; stock: number;
  status: string; categoryId: string; images: string[]; category?: { name: string; id: string };
}

interface Category { id: string; name: string; }

const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
  draft: { label: "草稿", variant: "secondary" },
  pending: { label: "待审核", variant: "outline" },
  published: { label: "已上架", variant: "default" },
};

export default function AdminProductsPage() {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [search, setSearch] = useState("");
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["admin-products", search],
    queryFn: () => fetch(`/api/products?status=&search=${search}`).then((r) => r.json()),
  });

  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: () => fetch("/api/categories").then((r) => r.json()),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => fetch(`/api/products/${id}`, { method: "DELETE" }).then((r) => r.json()),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin-products"] }); toast.success("已删除"); },
    onError: (error: Error) => toast.error(error.message || "删除失败"),
  });

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    const body: Record<string, unknown> = {
      name: formData.get("name"),
      description: formData.get("description") || "",
      price: Math.round(parseFloat(formData.get("price") as string) * 100),
      stock: parseInt(formData.get("stock") as string) || 0,
      categoryId: formData.get("categoryId"),
      images: [],
      status: formData.get("status") || "draft",
    };

    const url = editing ? `/api/products/${editing.id}` : "/api/products";
    const method = editing ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      queryClient.invalidateQueries({ queryKey: ["admin-products"] });
      setOpen(false); setEditing(null); form.reset();
      toast.success(editing ? "已更新" : "已创建");
    } else {
      const err = await res.json();
      toast.error(err.error || "操作失败");
    }
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>商品管理</CardTitle>
        <div className="flex gap-2">
          <Input placeholder="搜索商品..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-48" />
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }}>
            <DialogTrigger>
              <Button onClick={() => setEditing(null)}>新增商品</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{editing ? "编辑" : "新增"}商品</DialogTitle></DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div><Label>名称</Label><Input name="name" defaultValue={editing?.name} required /></div>
                <div><Label>描述</Label><Input name="description" defaultValue={editing?.description} /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>价格（元）</Label><Input name="price" type="number" step="0.01" defaultValue={editing ? (editing.price / 100).toFixed(2) : ""} required /></div>
                  <div><Label>库存</Label><Input name="stock" type="number" defaultValue={editing?.stock ?? 0} required /></div>
                </div>
                <div>
                  <Label>分类</Label>
                  <select name="categoryId" defaultValue={editing?.categoryId ?? ""} className="w-full border rounded-md px-3 py-2" required>
                    <option value="">选择分类</option>
                    {(categories as Category[])?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <Label>状态</Label>
                  <select name="status" defaultValue={editing?.status ?? "draft"} className="w-full border rounded-md px-3 py-2">
                    <option value="draft">草稿</option>
                    <option value="pending">待审核</option>
                    <option value="published">已上架</option>
                  </select>
                </div>
                <Button type="submit" className="w-full">保存</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? <p>加载中...</p> : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>名称</TableHead><TableHead>价格</TableHead><TableHead>库存</TableHead><TableHead>状态</TableHead><TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data?.products as Product[])?.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell>¥{(p.price / 100).toFixed(2)}</TableCell>
                  <TableCell>{p.stock}</TableCell>
                  <TableCell><Badge variant={statusMap[p.status]?.variant ?? "secondary"}>{statusMap[p.status]?.label ?? p.status}</Badge></TableCell>
                  <TableCell className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => { setEditing(p); setOpen(true); }}>编辑</Button>
                    <Button size="sm" variant="destructive" onClick={() => { if (confirm("确定删除？")) deleteMutation.mutate(p.id); }}>删除</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
