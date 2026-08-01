import Link from "next/link";
import { requireAccess } from "@/lib/require-session";
import { canWrite, type RoleName } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { formatThaiDateTime } from "@/lib/format";
import { RETURN_STATUS_LABELS, RETURN_STATUS_BADGE } from "@/lib/labels";
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

export default async function ReturnsPage() {
  const session = await requireAccess("returns", "read");
  const role = session.user.role as RoleName;
  const canManage = canWrite(role, "returns");

  const returns = await prisma.return.findMany({
    orderBy: { receivedAt: "desc" },
    take: 100,
    include: {
      order: { include: { merchant: { select: { name: true } } } },
      _count: { select: { items: true } },
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">การคืนสินค้า</h1>
          <p className="text-muted-foreground">รายการรับคืนสินค้าจากออเดอร์ที่จัดส่งแล้ว</p>
        </div>
        {canManage && (
          <Link href="/returns/new" className={buttonVariants()}>
            + รับคืนสินค้า
          </Link>
        )}
      </div>

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ออเดอร์</TableHead>
              <TableHead>Merchant</TableHead>
              <TableHead>เหตุผล</TableHead>
              <TableHead className="text-right">รายการ</TableHead>
              <TableHead>สถานะ</TableHead>
              <TableHead>รับคืนเมื่อ</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {returns.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  ยังไม่มีรายการคืนสินค้า
                </TableCell>
              </TableRow>
            )}
            {returns.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">
                  <Link href={`/returns/${r.id}`} className="hover:underline">
                    {r.order.customerName}
                  </Link>
                </TableCell>
                <TableCell>{r.order.merchant.name}</TableCell>
                <TableCell className="max-w-64 truncate">{r.reason}</TableCell>
                <TableCell className="text-right">{r._count.items}</TableCell>
                <TableCell>
                  <Badge variant={RETURN_STATUS_BADGE[r.status]}>{RETURN_STATUS_LABELS[r.status]}</Badge>
                </TableCell>
                <TableCell>{formatThaiDateTime(r.receivedAt)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
