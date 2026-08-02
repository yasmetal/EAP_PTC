import { requireSession } from "@/lib/require-session";
import { canRead, ROLE_LABELS, type RoleName } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { formatBaht, formatNumber } from "@/lib/format";
import { ORDER_STATUS_LABELS, INVOICE_STATUS_LABELS } from "@/lib/labels";
import { inboundReceiptsPerDay, ordersPerDay, recentDayKeys, toSeries } from "@/lib/analytics";
import type { OrderStatus, InvoiceStatus } from "@prisma/client";
import { BrandMark } from "@/components/brand-logo";
import { ChartCard, ChartDataTable, ChartEmpty } from "@/components/charts/chart-card";
import { StatTile } from "@/components/charts/stat-tile";
import { TrendChart } from "@/components/charts/trend-chart";
import { BarChart } from "@/components/charts/bar-chart";

const TREND_DAYS = 14;

export default async function DashboardPage() {
  const session = await requireSession();
  const role = session.user.role as RoleName;

  const showOrders = canRead(role, "orders");
  const showInbound = canRead(role, "inbound") || canRead(role, "inventory");
  const showBilling = canRead(role, "billing");
  const showMerchants = canRead(role, "merchants");

  const [
    merchantCount,
    productCount,
    lowStockCount,
    pendingOrderCount,
    pendingPickCount,
    readyToShipCount,
    draftInvoiceCount,
    pendingReturnsCount,
    orderTrendRaw,
    inboundTrendRaw,
    orderStatusCounts,
    topProductRows,
    topMerchantRows,
    invoiceStatusSums,
  ] = await Promise.all([
    canRead(role, "merchants") ? prisma.merchant.count({ where: { status: "active" } }) : null,
    canRead(role, "products") ? prisma.product.count() : null,
    canRead(role, "inventory")
      ? prisma.inventory.count({ where: { quantity: { lte: 10 } } })
      : null,
    canRead(role, "orders") ? prisma.order.count({ where: { status: "PENDING" } }) : null,
    canRead(role, "pickpack")
      ? prisma.pickList.count({ where: { status: { in: ["PENDING", "IN_PROGRESS"] } } })
      : null,
    canRead(role, "orders") ? prisma.order.count({ where: { status: "PACKED" } }) : null,
    canRead(role, "billing") ? prisma.invoice.count({ where: { status: "DRAFT" } }) : null,
    canRead(role, "returns")
      ? prisma.return.count({ where: { status: { in: ["RECEIVED", "INSPECTING"] } } })
      : null,
    showOrders ? ordersPerDay(TREND_DAYS) : null,
    showInbound ? inboundReceiptsPerDay(TREND_DAYS) : null,
    showOrders ? prisma.order.groupBy({ by: ["status"], _count: { _all: true } }) : null,
    showOrders
      ? prisma.orderItem.groupBy({
          by: ["productId"],
          where: { order: { status: "SHIPPED" } },
          _sum: { qty: true },
          orderBy: { _sum: { qty: "desc" } },
          take: 5,
        })
      : null,
    showOrders && showMerchants
      ? prisma.order.groupBy({
          by: ["merchantId"],
          _count: { merchantId: true },
          orderBy: { _count: { merchantId: "desc" } },
          take: 5,
        })
      : null,
    showBilling ? prisma.invoice.groupBy({ by: ["status"], _sum: { totalAmount: true } }) : null,
  ]);

  const [topProducts, topMerchants] = await Promise.all([
    topProductRows?.length
      ? prisma.product.findMany({
          where: { id: { in: topProductRows.map((r) => r.productId) } },
          select: { id: true, sku: true, name: true, merchant: { select: { name: true } } },
        })
      : [],
    topMerchantRows?.length
      ? prisma.merchant.findMany({
          where: { id: { in: topMerchantRows.map((r) => r.merchantId) } },
          select: { id: true, name: true },
        })
      : [],
  ]);

  const dayKeys = recentDayKeys(TREND_DAYS);
  const orderTrend = orderTrendRaw ? toSeries(dayKeys, orderTrendRaw, "ออเดอร์") : null;
  const inboundTrend = inboundTrendRaw ? toSeries(dayKeys, inboundTrendRaw, "ครั้ง") : null;

  const tiles = [
    { href: "/merchants", label: "Merchant ที่ใช้งานอยู่", value: merchantCount },
    { href: "/products", label: "SKU ทั้งหมด", value: productCount },
    { href: "/inventory", label: "ตำแหน่งที่สต็อกเหลือน้อย (≤10)", value: lowStockCount },
    { href: "/orders", label: "ออเดอร์รอดำเนินการ", value: pendingOrderCount },
    { href: "/pick-pack", label: "ใบหยิบที่รอดำเนินการ", value: pendingPickCount },
    { href: "/orders", label: "ออเดอร์รอจัดส่ง (แพ็คแล้ว)", value: readyToShipCount },
    { href: "/billing", label: "ใบแจ้งหนี้ฉบับร่าง", value: draftInvoiceCount },
    { href: "/returns", label: "การคืนสินค้าที่รอดำเนินการ", value: pendingReturnsCount },
  ].filter((t): t is { href: string; label: string; value: number } => t.value !== null);

  const orderStatusItems = orderStatusCounts
    ? (Object.keys(ORDER_STATUS_LABELS) as OrderStatus[]).map((status) => {
        const value = orderStatusCounts.find((s) => s.status === status)?._count._all ?? 0;
        return {
          label: ORDER_STATUS_LABELS[status],
          value,
          display: formatNumber(value),
        };
      })
    : null;

  const topProductItems = topProductRows
    ? topProductRows.map((row) => {
        const product = topProducts.find((p) => p.id === row.productId);
        const value = row._sum.qty ?? 0;
        return {
          label: product?.name ?? "(ไม่พบสินค้า)",
          value,
          display: formatNumber(value),
          tooltip: `${product?.name ?? "-"} (${product?.sku ?? "-"}) · ${product?.merchant.name ?? "-"} — ${formatNumber(value)} ชิ้น`,
        };
      })
    : null;

  const topMerchantItems = topMerchantRows
    ? topMerchantRows.map((row) => {
        const value = row._count.merchantId;
        return {
          label: topMerchants.find((m) => m.id === row.merchantId)?.name ?? "(ไม่พบร้านค้า)",
          value,
          display: formatNumber(value),
        };
      })
    : null;

  const invoiceItems = invoiceStatusSums
    ? (Object.keys(INVOICE_STATUS_LABELS) as InvoiceStatus[]).map((status) => {
        const value = Number(
          invoiceStatusSums.find((s) => s.status === status)?._sum.totalAmount ?? 0
        );
        return { label: INVOICE_STATUS_LABELS[status], value, display: formatBaht(value) };
      })
    : null;

  const hasCharts =
    Boolean(orderTrend) ||
    Boolean(inboundTrend) ||
    Boolean(orderStatusItems) ||
    Boolean(topProductItems?.length) ||
    Boolean(topMerchantItems?.length) ||
    Boolean(invoiceItems);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <BrandMark className="size-12" priority />
        <div>
          <h1 className="text-2xl font-semibold">สวัสดี, {session.user.name}</h1>
          <p className="text-muted-foreground">บทบาท: {ROLE_LABELS[role]}</p>
        </div>
      </div>

      {tiles.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {tiles.map((t) => (
            <StatTile
              key={t.label}
              href={t.href}
              label={t.label}
              value={formatNumber(t.value)}
            />
          ))}
        </div>
      )}

      {hasCharts ? (
        <div className="grid gap-4 xl:grid-cols-2">
          {orderTrend && (
            <ChartCard
              title={`ออเดอร์ต่อวัน (${TREND_DAYS} วันล่าสุด)`}
              description="นับตามวันที่สร้างออเดอร์ ตามเวลาประเทศไทย"
              table={
                <ChartDataTable
                  columns={["วันที่", "จำนวนออเดอร์"]}
                  rows={orderTrend.map((p) => [p.full, formatNumber(p.value)])}
                />
              }
            >
              <TrendChart points={orderTrend} color="var(--chart-1)" />
            </ChartCard>
          )}

          {inboundTrend && (
            <ChartCard
              title={`การรับสินค้าเข้าคลังต่อวัน (${TREND_DAYS} วันล่าสุด)`}
              description="นับจำนวนครั้งที่บันทึกรับสินค้าเข้าสต็อก"
              table={
                <ChartDataTable
                  columns={["วันที่", "จำนวนครั้ง"]}
                  rows={inboundTrend.map((p) => [p.full, formatNumber(p.value)])}
                />
              }
            >
              <TrendChart points={inboundTrend} color="var(--chart-3)" />
            </ChartCard>
          )}

          {orderStatusItems && (
            <ChartCard
              title="ออเดอร์ตามสถานะ"
              description={`รวมทั้งหมด ${formatNumber(
                orderStatusItems.reduce((sum, i) => sum + i.value, 0)
              )} ออเดอร์`}
              table={
                <ChartDataTable
                  columns={["สถานะ", "จำนวน"]}
                  rows={orderStatusItems.map((i) => [i.label, i.display])}
                />
              }
            >
              <BarChart items={orderStatusItems} />
            </ChartCard>
          )}

          {topProductItems && (
            <ChartCard
              title="สินค้าขายดี 5 อันดับ"
              description="นับจากจำนวนชิ้นในออเดอร์ที่จัดส่งแล้ว"
              table={
                <ChartDataTable
                  columns={["สินค้า", "จำนวนที่จัดส่งแล้ว"]}
                  rows={topProductItems.map((i) => [i.label, i.display])}
                />
              }
            >
              {topProductItems.length > 0 ? (
                <BarChart items={topProductItems} />
              ) : (
                <ChartEmpty message="ยังไม่มีออเดอร์ที่จัดส่งแล้ว" />
              )}
            </ChartCard>
          )}

          {topMerchantItems && (
            <ChartCard
              title="ร้านค้าที่มีออเดอร์มากที่สุด 5 อันดับ"
              description="นับจากจำนวนออเดอร์ทั้งหมดของแต่ละร้านค้า"
              table={
                <ChartDataTable
                  columns={["ร้านค้า", "จำนวนออเดอร์"]}
                  rows={topMerchantItems.map((i) => [i.label, i.display])}
                />
              }
            >
              {topMerchantItems.length > 0 ? (
                <BarChart items={topMerchantItems} />
              ) : (
                <ChartEmpty message="ยังไม่มีออเดอร์ในระบบ" />
              )}
            </ChartCard>
          )}

          {invoiceItems && (
            <ChartCard
              title="ยอดใบแจ้งหนี้ตามสถานะ"
              description="มูลค่ารวมของใบแจ้งหนี้ในแต่ละสถานะ"
              table={
                <ChartDataTable
                  columns={["สถานะ", "มูลค่ารวม"]}
                  rows={invoiceItems.map((i) => [i.label, i.display])}
                />
              }
            >
              {/* ค่าเงินบาทยาวกว่าจำนวนนับ จึงเผื่อที่ท้ายแท่งไว้มากขึ้นกันตัวเลขล้นขอบ */}
              <BarChart items={invoiceItems} valueGutter={118} />
            </ChartCard>
          )}
        </div>
      ) : (
        tiles.length === 0 && (
          <p className="text-muted-foreground">ยังไม่มีข้อมูลสรุปสำหรับบทบาทนี้</p>
        )
      )}
    </div>
  );
}
