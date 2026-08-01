import Link from "next/link";
import { requireAccess } from "@/lib/require-session";
import { prisma } from "@/lib/prisma";
import { formatThaiDateTime } from "@/lib/format";
import { PICKLIST_STATUS_LABELS } from "@/lib/labels";
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

export default async function PickPackListPage() {
  await requireAccess("pickpack", "read");

  const pickLists = await prisma.pickList.findMany({
    where: { status: { in: ["PENDING", "IN_PROGRESS"] } },
    orderBy: { createdAt: "asc" },
    include: {
      order: { include: { merchant: { select: { name: true } } } },
      assignee: { select: { name: true } },
      _count: { select: { items: true } },
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">หยิบ-แพ็คสินค้า (Pick &amp; Pack)</h1>
        <p className="text-muted-foreground">ใบหยิบที่รอดำเนินการ เรียงจากเก่าไปใหม่</p>
      </div>

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ลูกค้า</TableHead>
              <TableHead>Merchant</TableHead>
              <TableHead className="text-right">รายการ</TableHead>
              <TableHead>สถานะ</TableHead>
              <TableHead>ผู้รับผิดชอบ</TableHead>
              <TableHead>สร้างเมื่อ</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {pickLists.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  ไม่มีใบหยิบที่รอดำเนินการ
                </TableCell>
              </TableRow>
            )}
            {pickLists.map((pl) => (
              <TableRow key={pl.id}>
                <TableCell className="font-medium">{pl.order.customerName}</TableCell>
                <TableCell>{pl.order.merchant.name}</TableCell>
                <TableCell className="text-right">{pl._count.items}</TableCell>
                <TableCell>
                  <Badge variant="secondary">{PICKLIST_STATUS_LABELS[pl.status]}</Badge>
                </TableCell>
                <TableCell>{pl.assignee?.name ?? "-"}</TableCell>
                <TableCell>{formatThaiDateTime(pl.createdAt)}</TableCell>
                <TableCell>
                  <Link href={`/pick-pack/${pl.id}`} className={buttonVariants({ size: "sm" })}>
                    หยิบสินค้า
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
