import Link from "next/link";
import { requireAccess } from "@/lib/require-session";
import { canWrite, type RoleName } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { formatThaiDateTime } from "@/lib/format";
import { ORDER_STATUS_LABELS, ORDER_STATUS_BADGE } from "@/lib/labels";
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

export default async function OrdersPage() {
  const session = await requireAccess("orders", "read");
  const role = session.user.role as RoleName;
  const canManage = canWrite(role, "orders");

  const orders = await prisma.order.findMany({
    orderBy: { createdAt: "desc" },
    include: { merchant: { select: { name: true } }, _count: { select: { items: true } } },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">ออเดอร์</h1>
          <p className="text-muted-foreground">รายการคำสั่งซื้อทั้งหมด</p>
        </div>
        {canManage && (
          <Link href="/orders/new" className={buttonVariants()}>
            + สร้างออเดอร์
          </Link>
        )}
      </div>

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ลูกค้า</TableHead>
              <TableHead>Merchant</TableHead>
              <TableHead>ช่องทาง</TableHead>
              <TableHead className="text-right">รายการ</TableHead>
              <TableHead>สถานะ</TableHead>
              <TableHead>สร้างเมื่อ</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  ยังไม่มีออเดอร์
                </TableCell>
              </TableRow>
            )}
            {orders.map((o) => (
              <TableRow key={o.id}>
                <TableCell className="font-medium">
                  <Link href={`/orders/${o.id}`} className="hover:underline">
                    {o.customerName}
                  </Link>
                  {o.externalOrderNo && (
                    <div className="text-xs text-muted-foreground">#{o.externalOrderNo}</div>
                  )}
                </TableCell>
                <TableCell>{o.merchant.name}</TableCell>
                <TableCell>{o.channel}</TableCell>
                <TableCell className="text-right">{o._count.items}</TableCell>
                <TableCell>
                  <Badge variant={ORDER_STATUS_BADGE[o.status]}>{ORDER_STATUS_LABELS[o.status]}</Badge>
                </TableCell>
                <TableCell>{formatThaiDateTime(o.createdAt)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
