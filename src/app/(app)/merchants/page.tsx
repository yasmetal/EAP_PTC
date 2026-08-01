import Link from "next/link";
import { requireAccess } from "@/lib/require-session";
import { canWrite, type RoleName } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { formatThaiDate } from "@/lib/format";
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

export default async function MerchantsPage() {
  const session = await requireAccess("merchants", "read");
  const role = session.user.role as RoleName;
  const canManage = canWrite(role, "merchants");

  const merchants = await prisma.merchant.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { products: true, orders: true } } },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">ลูกค้า (Merchant)</h1>
          <p className="text-muted-foreground">ร้านค้าที่ฝากสินค้ากับคลัง</p>
        </div>
        {canManage && (
          <Link href="/merchants/new" className={buttonVariants()}>
            + เพิ่ม Merchant
          </Link>
        )}
      </div>

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ชื่อร้านค้า</TableHead>
              <TableHead>อีเมลติดต่อ</TableHead>
              <TableHead>สถานะ</TableHead>
              <TableHead className="text-right">SKU</TableHead>
              <TableHead className="text-right">ออเดอร์</TableHead>
              <TableHead>สร้างเมื่อ</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {merchants.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  ยังไม่มีข้อมูล Merchant
                </TableCell>
              </TableRow>
            )}
            {merchants.map((m) => (
              <TableRow key={m.id}>
                <TableCell className="font-medium">
                  <Link href={`/merchants/${m.id}`} className="hover:underline">
                    {m.name}
                  </Link>
                </TableCell>
                <TableCell>{m.contactEmail}</TableCell>
                <TableCell>
                  <Badge variant={m.status === "active" ? "default" : "secondary"}>
                    {m.status === "active" ? "ใช้งาน" : "ปิดใช้งาน"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">{m._count.products}</TableCell>
                <TableCell className="text-right">{m._count.orders}</TableCell>
                <TableCell>{formatThaiDate(m.createdAt)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
