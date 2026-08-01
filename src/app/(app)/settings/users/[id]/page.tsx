import { notFound } from "next/navigation";
import { requireAccess } from "@/lib/require-session";
import { prisma } from "@/lib/prisma";
import { formatThaiDate } from "@/lib/format";
import { ROLE_LABELS, type RoleName } from "@/lib/permissions";
import { updateUser } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function UserDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const session = await requireAccess("users", "write");

  const [user, roles] = await Promise.all([
    prisma.user.findUnique({ where: { id }, include: { role: true } }),
    prisma.role.findMany({ orderBy: { name: "asc" } }),
  ]);
  if (!user) notFound();

  const updateUserWithId = updateUser.bind(null, user.id);
  const isSelf = user.id === session.user.id;

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{user.name}</h1>
        <p className="text-muted-foreground">
          {user.email} · สร้างเมื่อ {formatThaiDate(user.createdAt)}
        </p>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>ข้อมูลผู้ใช้</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={updateUserWithId} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">ชื่อ-นามสกุล *</Label>
              <Input id="name" name="name" defaultValue={user.name} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">ตั้งรหัสผ่านใหม่ (เว้นว่างถ้าไม่ต้องการเปลี่ยน)</Label>
              <Input id="password" name="password" type="password" minLength={8} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="roleId">บทบาท *</Label>
              <NativeSelect id="roleId" name="roleId" defaultValue={user.roleId} required>
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {ROLE_LABELS[r.name as RoleName]}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">สถานะ</Label>
              <NativeSelect id="status" name="status" defaultValue={user.status}>
                <option value="active">ใช้งาน</option>
                <option value="inactive">ปิดใช้งาน</option>
              </NativeSelect>
              {isSelf && (
                <p className="text-xs text-muted-foreground">ไม่สามารถปิดใช้งานบัญชีของตัวเองได้</p>
              )}
            </div>
            <Button type="submit">บันทึกการแก้ไข</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
