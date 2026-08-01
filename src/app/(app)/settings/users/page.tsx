import Link from "next/link";
import { requireAccess } from "@/lib/require-session";
import { prisma } from "@/lib/prisma";
import { formatThaiDate } from "@/lib/format";
import { ROLE_LABELS, type RoleName } from "@/lib/permissions";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function UsersPage() {
  await requireAccess("users", "write");

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    include: { role: true },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">ผู้ใช้งานระบบ</h1>
          <p className="text-muted-foreground">จัดการบัญชีผู้ใช้และบทบาท</p>
        </div>
        <Link href="/settings/users/new" className={buttonVariants()}>
          + เพิ่มผู้ใช้
        </Link>
      </div>

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ชื่อ</TableHead>
              <TableHead>อีเมล</TableHead>
              <TableHead>บทบาท</TableHead>
              <TableHead>สถานะ</TableHead>
              <TableHead>สร้างเมื่อ</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((u) => (
              <TableRow key={u.id}>
                <TableCell className="font-medium">
                  <Link href={`/settings/users/${u.id}`} className="hover:underline">
                    {u.name}
                  </Link>
                </TableCell>
                <TableCell>{u.email}</TableCell>
                <TableCell>{ROLE_LABELS[u.role.name as RoleName]}</TableCell>
                <TableCell>
                  <Badge variant={u.status === "active" ? "default" : "secondary"}>
                    {u.status === "active" ? "ใช้งาน" : "ปิดใช้งาน"}
                  </Badge>
                </TableCell>
                <TableCell>{formatThaiDate(u.createdAt)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
