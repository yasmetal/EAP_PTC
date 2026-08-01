import { requireAccess } from "@/lib/require-session";
import { prisma } from "@/lib/prisma";
import { ROLE_LABELS, type RoleName } from "@/lib/permissions";
import { createUser } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function NewUserPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requireAccess("users", "write");
  const { error } = await searchParams;

  const roles = await prisma.role.findMany({ orderBy: { name: "asc" } });

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <h1 className="text-2xl font-semibold">เพิ่มผู้ใช้</h1>
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
          <form action={createUser} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">ชื่อ-นามสกุล *</Label>
              <Input id="name" name="name" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">อีเมล *</Label>
              <Input id="email" name="email" type="email" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">รหัสผ่าน *</Label>
              <Input id="password" name="password" type="password" minLength={8} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="roleId">บทบาท *</Label>
              <NativeSelect id="roleId" name="roleId" required defaultValue="">
                <option value="">-- เลือก --</option>
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {ROLE_LABELS[r.name as RoleName]}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">สถานะ</Label>
              <NativeSelect id="status" name="status" defaultValue="active">
                <option value="active">ใช้งาน</option>
                <option value="inactive">ปิดใช้งาน</option>
              </NativeSelect>
            </div>
            <Button type="submit">บันทึก</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
