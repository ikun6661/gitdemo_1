"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

type UserRoleView = "admin" | "operator" | "customer";

interface UserView {
  id: string;
  name: string;
  email: string;
  role: UserRoleView;
  createdAt: string;
}

const roleMap: Record<UserRoleView, { label: string; variant: "default" | "secondary" | "outline" }> = {
  admin: { label: "管理员", variant: "default" },
  operator: { label: "运营", variant: "secondary" },
  customer: { label: "用户", variant: "outline" },
};

export default function AdminUsersPage() {
  const queryClient = useQueryClient();

  const { data: users, isLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => fetch("/api/users").then((r) => r.json()),
  });

  const roleMutation = useMutation({
    mutationFn: ({ id, role }: { id: string; role: UserRoleView }) =>
      fetch(`/api/users/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ role }) }).then((r) => r.json()),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin-users"] }); toast.success("角色已更新"); },
    onError: (error: Error) => toast.error(error.message || "更新失败"),
  });

  return (
    <Card>
      <CardHeader><CardTitle>用户管理</CardTitle></CardHeader>
      <CardContent>
        {isLoading ? <p>加载中...</p> : (
          <Table>
            <TableHeader>
              <TableRow><TableHead>姓名</TableHead><TableHead>邮箱</TableHead><TableHead>角色</TableHead><TableHead>操作</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {(users as UserView[] | undefined)?.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>{user.name}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell><Badge variant={roleMap[user.role]?.variant}>{roleMap[user.role]?.label}</Badge></TableCell>
                  <TableCell>
                    <select
                      defaultValue={user.role}
                      onChange={(event) =>
                        roleMutation.mutate({
                          id: user.id,
                          role: event.target.value as UserRoleView,
                        })
                      }
                      className="border rounded px-2 py-1 text-sm"
                    >
                      <option value="admin">管理员</option>
                      <option value="operator">运营</option>
                      <option value="customer">用户</option>
                    </select>
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
