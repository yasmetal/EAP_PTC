import Link from "next/link";
import { requireAccess } from "@/lib/require-session";
import { canWrite, type RoleName } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { formatThaiDateTime } from "@/lib/format";
import {
  ORDER_STATUS_LABELS,
  ORDER_STATUS_BADGE,
  SHIPMENT_STATUS_LABELS,
  SHIPMENT_STATUS_BADGE,
} from "@/lib/labels";
import { isThailandPostConfigured } from "@/lib/thailand-post";
import { refreshAllTracking, registerTrackingWebhook } from "./tracking-actions";
import { TrackingRefreshButton } from "@/components/tracking/tracking-refresh-button";
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
  const trackingConfigured = isThailandPostConfigured();

  const orders = await prisma.order.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      merchant: { select: { name: true } },
      _count: { select: { items: true } },
      // เอาเฉพาะการจัดส่งล่าสุดของแต่ละออเดอร์มาแสดงในคอลัมน์สถานะพัสดุ
      shipments: {
        orderBy: { shippedAt: "desc" },
        take: 1,
        select: {
          id: true,
          status: true,
          trackingNo: true,
          trackingStatusText: true,
          trackingUpdatedAt: true,
        },
      },
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">ออเดอร์</h1>
          <p className="text-muted-foreground">รายการคำสั่งซื้อทั้งหมด</p>
        </div>
        <div className="flex flex-wrap items-start gap-2">
          {canManage && trackingConfigured && (
            <>
              <TrackingRefreshButton
                action={refreshAllTracking}
                label="อัปเดตสถานะพัสดุทั้งหมด"
                pendingLabel="กำลังดึงข้อมูล..."
              />
              <TrackingRefreshButton
                action={registerTrackingWebhook}
                label="ลงทะเบียนรับแจ้งเตือนอัตโนมัติ"
                pendingLabel="กำลังลงทะเบียน..."
                variant="ghost"
              />
            </>
          )}
          {canManage && (
            <Link href="/orders/new" className={buttonVariants()}>
              + สร้างออเดอร์
            </Link>
          )}
        </div>
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
              <TableHead>สถานะพัสดุ</TableHead>
              <TableHead>สร้างเมื่อ</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  ยังไม่มีออเดอร์
                </TableCell>
              </TableRow>
            )}
            {orders.map((o) => {
              const shipment = o.shipments[0];
              return (
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
                    <Badge variant={ORDER_STATUS_BADGE[o.status]}>
                      {ORDER_STATUS_LABELS[o.status]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {shipment ? (
                      <div className="space-y-1">
                        <Badge variant={SHIPMENT_STATUS_BADGE[shipment.status]}>
                          {SHIPMENT_STATUS_LABELS[shipment.status]}
                        </Badge>
                        {shipment.trackingStatusText && (
                          <div className="max-w-[16rem] truncate text-xs text-muted-foreground">
                            {shipment.trackingStatusText}
                          </div>
                        )}
                        {shipment.trackingNo && (
                          <div className="font-mono text-xs text-muted-foreground">
                            {shipment.trackingNo}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>{formatThaiDateTime(o.createdAt)}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
