import Link from "next/link";
import { requireAccess } from "@/lib/require-session";
import { prisma } from "@/lib/prisma";
import { formatThaiDateTime } from "@/lib/format";
import { ROLE_LABELS, type RoleName } from "@/lib/permissions";
import { NativeSelect } from "@/components/ui/native-select";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const ENTITY_LINK: Record<string, (id: string) => string> = {
  Order: (id) => `/orders/${id}`,
  Merchant: (id) => `/merchants/${id}`,
  Product: (id) => `/products/${id}`,
  Invoice: (id) => `/billing/${id}`,
  Return: (id) => `/returns/${id}`,
  User: (id) => `/settings/users/${id}`,
};

export default async function ActivityLogPage({
  searchParams,
}: {
  searchParams: Promise<{ entityType?: string }>;
}) {
  await requireAccess("activityLog", "read");
  const { entityType } = await searchParams;

  const entityTypes = await prisma.activityLog.findMany({
    distinct: ["entityType"],
    select: { entityType: true },
    orderBy: { entityType: "asc" },
  });

  const logs = await prisma.activityLog.findMany({
    where: entityType ? { entityType } : undefined,
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { user: { include: { role: true } } },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">ประวัติการทำงาน (Activity Log)</h1>
        <p className="text-muted-foreground">
          บันทึกการเปลี่ยนแปลงข้อมูลทุกรายการในระบบ (ล่าสุด 200 รายการ)
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form method="GET" className="flex items-end gap-3">
            <div className="max-w-xs flex-1 space-y-2">
              <NativeSelect name="entityType" defaultValue={entityType ?? ""}>
                <option value="">-- ทุกประเภท --</option>
                {entityTypes.map((e) => (
                  <option key={e.entityType} value={e.entityType}>
                    {e.entityType}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <Button type="submit" variant="outline">
              กรอง
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>เวลา</TableHead>
              <TableHead>ผู้ทำรายการ</TableHead>
              <TableHead>บทบาท</TableHead>
              <TableHead>การกระทำ</TableHead>
              <TableHead>ประเภท</TableHead>
              <TableHead>รหัสอ้างอิง</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  ไม่พบข้อมูล
                </TableCell>
              </TableRow>
            )}
            {logs.map((log) => {
              const link = ENTITY_LINK[log.entityType]?.(log.entityId);
              return (
                <TableRow key={log.id}>
                  <TableCell className="whitespace-nowrap">{formatThaiDateTime(log.createdAt)}</TableCell>
                  <TableCell>{log.user.name}</TableCell>
                  <TableCell>{ROLE_LABELS[log.user.role.name as RoleName]}</TableCell>
                  <TableCell className="font-mono text-xs">{log.action}</TableCell>
                  <TableCell>{log.entityType}</TableCell>
                  <TableCell className="font-mono text-xs">
                    {link ? (
                      <Link href={link} className="hover:underline">
                        {log.entityId.slice(0, 8)}
                      </Link>
                    ) : (
                      log.entityId.slice(0, 8)
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
