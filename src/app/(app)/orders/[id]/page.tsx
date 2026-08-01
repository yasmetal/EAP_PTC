import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAccess } from "@/lib/require-session";
import { canWrite, type RoleName } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { formatThaiDateTime, formatBaht, formatNumber } from "@/lib/format";
import {
  ORDER_STATUS_LABELS,
  ORDER_STATUS_BADGE,
  PICKLIST_STATUS_LABELS,
  SHIPMENT_STATUS_LABELS,
  SHIPMENT_STATUS_BADGE,
} from "@/lib/labels";
import { allocateOrder, cancelOrder, shipOrder } from "../actions";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function OrderDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const session = await requireAccess("orders", "read");
  const role = session.user.role as RoleName;
  const canManage = canWrite(role, "orders");

  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      merchant: { select: { id: true, name: true } },
      items: { include: { product: true } },
      pickList: true,
      shipments: { orderBy: { shippedAt: "desc" } },
    },
  });

  if (!order) notFound();

  const total = order.items.reduce((sum, item) => sum + item.qty * Number(item.unitPrice), 0);
  const allocateWithId = allocateOrder.bind(null, order.id);
  const cancelWithId = cancelOrder.bind(null, order.id);
  const shipWithId = shipOrder.bind(null, order.id);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">ออเดอร์: {order.customerName}</h1>
          <p className="text-muted-foreground">
            <Link href={`/merchants/${order.merchant.id}`} className="hover:underline">
              {order.merchant.name}
            </Link>{" "}
            · {order.channel} · สร้างเมื่อ {formatThaiDateTime(order.createdAt)}
          </p>
        </div>
        <Badge variant={ORDER_STATUS_BADGE[order.status]}>{ORDER_STATUS_LABELS[order.status]}</Badge>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {canManage && order.status === "PENDING" && (
        <div className="flex gap-2">
          <form action={allocateWithId}>
            <Button type="submit">จัดสรรสต็อก (Allocate)</Button>
          </form>
          <form action={cancelWithId}>
            <Button type="submit" variant="outline">
              ยกเลิกออเดอร์
            </Button>
          </form>
        </div>
      )}
      {canManage && (order.status === "ALLOCATED" || order.status === "PICKING") && (
        <div className="flex gap-2">
          <form action={cancelWithId}>
            <Button type="submit" variant="outline">
              ยกเลิกออเดอร์
            </Button>
          </form>
        </div>
      )}

      {canManage && order.status === "PACKED" && (
        <Card>
          <CardHeader>
            <CardTitle>บันทึกการจัดส่ง</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={shipWithId} className="grid gap-4 sm:grid-cols-3 sm:items-end">
              <div className="space-y-2">
                <Label htmlFor="courier">ขนส่ง *</Label>
                <Input id="courier" name="courier" placeholder="เช่น Kerry, Flash, ไปรษณีย์ไทย" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="trackingNo">เลขพัสดุ</Label>
                <Input id="trackingNo" name="trackingNo" />
              </div>
              <Button type="submit">ยืนยันจัดส่ง</Button>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>ที่อยู่จัดส่ง</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="whitespace-pre-line text-sm">{order.customerAddress}</p>
          {order.externalOrderNo && (
            <p className="mt-2 text-sm text-muted-foreground">
              เลขที่อ้างอิง: {order.externalOrderNo}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>รายการสินค้า</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SKU</TableHead>
                  <TableHead>สินค้า</TableHead>
                  <TableHead className="text-right">จำนวน</TableHead>
                  <TableHead className="text-right">ราคา/หน่วย</TableHead>
                  <TableHead className="text-right">รวม</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {order.items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-mono text-sm">{item.product.sku}</TableCell>
                    <TableCell>{item.product.name}</TableCell>
                    <TableCell className="text-right">{formatNumber(item.qty)}</TableCell>
                    <TableCell className="text-right">{formatBaht(item.unitPrice.toString())}</TableCell>
                    <TableCell className="text-right">
                      {formatBaht(item.qty * Number(item.unitPrice))}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <p className="mt-3 text-right font-medium">รวมทั้งสิ้น: {formatBaht(total)}</p>
        </CardContent>
      </Card>

      {order.pickList && (
        <Card>
          <CardHeader>
            <CardTitle>ใบหยิบสินค้า (Pick List)</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <p className="text-sm">
              สถานะ: <Badge variant="secondary">{PICKLIST_STATUS_LABELS[order.pickList.status]}</Badge>
            </p>
            <Link href={`/pick-pack/${order.pickList.id}`} className={buttonVariants({ variant: "outline" })}>
              ไปหน้าหยิบ-แพ็ค
            </Link>
          </CardContent>
        </Card>
      )}

      {order.shipments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>ประวัติการจัดส่ง</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ขนส่ง</TableHead>
                    <TableHead>เลขพัสดุ</TableHead>
                    <TableHead>สถานะ</TableHead>
                    <TableHead>วันที่จัดส่ง</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {order.shipments.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell>{s.courier}</TableCell>
                      <TableCell className="font-mono text-sm">{s.trackingNo || "-"}</TableCell>
                      <TableCell>
                        <Badge variant={SHIPMENT_STATUS_BADGE[s.status]}>
                          {SHIPMENT_STATUS_LABELS[s.status]}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatThaiDateTime(s.shippedAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
