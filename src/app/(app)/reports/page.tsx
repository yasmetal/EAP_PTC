import { requireAccess } from "@/lib/require-session";
import { canRead, type RoleName } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { formatBaht, formatNumber } from "@/lib/format";
import { ORDER_STATUS_LABELS, RETURN_STATUS_LABELS } from "@/lib/labels";
import type { OrderStatus, ReturnStatus, InvoiceStatus } from "@prisma/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function ReportsPage() {
  const session = await requireAccess("reports", "read");
  const role = session.user.role as RoleName;

  const showOrders = canRead(role, "orders");
  const showInventory = canRead(role, "inventory");
  const showReturns = canRead(role, "returns");
  const showBilling = canRead(role, "billing");

  const [orderStatusCounts, invoiceStatusSums, skuCount, lowStockCount, unitsSum, returnStatusCounts, topProductRows] =
    await Promise.all([
      showOrders ? prisma.order.groupBy({ by: ["status"], _count: { _all: true } }) : null,
      showBilling ? prisma.invoice.groupBy({ by: ["status"], _sum: { totalAmount: true } }) : null,
      showInventory ? prisma.product.count() : null,
      showInventory ? prisma.inventory.count({ where: { quantity: { lte: 10 } } }) : null,
      showInventory ? prisma.inventory.aggregate({ _sum: { quantity: true } }) : null,
      showReturns ? prisma.return.groupBy({ by: ["status"], _count: { _all: true } }) : null,
      showOrders
        ? prisma.orderItem.groupBy({
            by: ["productId"],
            where: { order: { status: "SHIPPED" } },
            _sum: { qty: true },
            orderBy: { _sum: { qty: "desc" } },
            take: 5,
          })
        : null,
    ]);

  const topProducts = topProductRows
    ? await prisma.product.findMany({
        where: { id: { in: topProductRows.map((r) => r.productId) } },
        select: { id: true, sku: true, name: true },
      })
    : [];
  const topProductsWithQty = (topProductRows ?? []).map((r) => ({
    product: topProducts.find((p) => p.id === r.productId),
    qty: r._sum.qty ?? 0,
  }));

  const orderCountByStatus = (status: OrderStatus) =>
    orderStatusCounts?.find((s) => s.status === status)?._count._all ?? 0;
  const returnCountByStatus = (status: ReturnStatus) =>
    returnStatusCounts?.find((s) => s.status === status)?._count._all ?? 0;
  const invoiceSumByStatus = (status: InvoiceStatus) =>
    Number(invoiceStatusSums?.find((s) => s.status === status)?._sum.totalAmount ?? 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">รายงานสรุป</h1>
        <p className="text-muted-foreground">ภาพรวมการดำเนินงานคลังสินค้า</p>
      </div>

      {showOrders && orderStatusCounts && (
        <Card>
          <CardHeader>
            <CardTitle>ออเดอร์ตามสถานะ</CardTitle>
            <CardDescription>
              รวมทั้งหมด {formatNumber(orderStatusCounts.reduce((sum, r) => sum + r._count._all, 0))} ออเดอร์
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {(Object.keys(ORDER_STATUS_LABELS) as OrderStatus[]).map((status) => (
                <div key={status} className="rounded-md border p-3 text-center">
                  <p className="text-2xl font-semibold">{formatNumber(orderCountByStatus(status))}</p>
                  <p className="text-xs text-muted-foreground">{ORDER_STATUS_LABELS[status]}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {showOrders && topProductsWithQty.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>สินค้าขายดี (จากออเดอร์ที่จัดส่งแล้ว)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>SKU</TableHead>
                    <TableHead>สินค้า</TableHead>
                    <TableHead className="text-right">จำนวนที่จัดส่งแล้ว</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topProductsWithQty.map((row, i) => (
                    <TableRow key={row.product?.id ?? i}>
                      <TableCell className="font-mono text-sm">{row.product?.sku ?? "-"}</TableCell>
                      <TableCell>{row.product?.name ?? "-"}</TableCell>
                      <TableCell className="text-right">{formatNumber(row.qty)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {showInventory && (
        <Card>
          <CardHeader>
            <CardTitle>สินค้าคงคลัง</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-md border p-3 text-center">
                <p className="text-2xl font-semibold">{formatNumber(skuCount ?? 0)}</p>
                <p className="text-xs text-muted-foreground">SKU ทั้งหมด</p>
              </div>
              <div className="rounded-md border p-3 text-center">
                <p className="text-2xl font-semibold">{formatNumber(unitsSum?._sum.quantity ?? 0)}</p>
                <p className="text-xs text-muted-foreground">หน่วยรวมในคลัง</p>
              </div>
              <div className="rounded-md border p-3 text-center">
                <p className="text-2xl font-semibold">{formatNumber(lowStockCount ?? 0)}</p>
                <p className="text-xs text-muted-foreground">ตำแหน่งที่สต็อกเหลือน้อย (≤10)</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {showReturns && returnStatusCounts && (
        <Card>
          <CardHeader>
            <CardTitle>การคืนสินค้าตามสถานะ</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-3">
              {(Object.keys(RETURN_STATUS_LABELS) as ReturnStatus[]).map((status) => (
                <div key={status} className="rounded-md border p-3 text-center">
                  <p className="text-2xl font-semibold">{formatNumber(returnCountByStatus(status))}</p>
                  <p className="text-xs text-muted-foreground">{RETURN_STATUS_LABELS[status]}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {showBilling && invoiceStatusSums && (
        <Card>
          <CardHeader>
            <CardTitle>สรุปการเงิน (ใบแจ้งหนี้)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-md border p-3 text-center">
                <p className="text-2xl font-semibold">
                  {formatBaht(invoiceSumByStatus("ISSUED") + invoiceSumByStatus("PAID"))}
                </p>
                <p className="text-xs text-muted-foreground">ยอดเรียกเก็บสะสม (ออกแล้ว+ชำระแล้ว)</p>
              </div>
              <div className="rounded-md border p-3 text-center">
                <p className="text-2xl font-semibold">{formatBaht(invoiceSumByStatus("PAID"))}</p>
                <p className="text-xs text-muted-foreground">ยอดที่ชำระแล้ว</p>
              </div>
              <div className="rounded-md border p-3 text-center">
                <p className="text-2xl font-semibold">{formatBaht(invoiceSumByStatus("DRAFT"))}</p>
                <p className="text-xs text-muted-foreground">ฉบับร่าง (ยังไม่ออก)</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {!showOrders && !showInventory && !showReturns && !showBilling && (
        <p className="text-muted-foreground">ยังไม่มีข้อมูลรายงานสำหรับบทบาทนี้</p>
      )}
    </div>
  );
}
