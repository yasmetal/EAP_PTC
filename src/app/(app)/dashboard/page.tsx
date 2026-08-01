import Link from "next/link";
import { requireSession } from "@/lib/require-session";
import { canRead, ROLE_LABELS, type RoleName } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function DashboardPage() {
  const session = await requireSession();
  const role = session.user.role as RoleName;

  const [
    merchantCount,
    productCount,
    lowStockCount,
    pendingOrderCount,
    pendingPickCount,
    readyToShipCount,
    draftInvoiceCount,
    pendingReturnsCount,
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
  ]);

  const cards = [
    { href: "/merchants", label: "Merchant ที่ใช้งานอยู่", value: merchantCount },
    { href: "/products", label: "SKU ทั้งหมด", value: productCount },
    { href: "/inventory", label: "ตำแหน่งที่สต็อกเหลือน้อย (≤10)", value: lowStockCount },
    { href: "/orders", label: "ออเดอร์รอดำเนินการ", value: pendingOrderCount },
    { href: "/pick-pack", label: "ใบหยิบที่รอดำเนินการ", value: pendingPickCount },
    { href: "/orders", label: "ออเดอร์รอจัดส่ง (แพ็คแล้ว)", value: readyToShipCount },
    { href: "/billing", label: "ใบแจ้งหนี้ฉบับร่าง", value: draftInvoiceCount },
    { href: "/returns", label: "การคืนสินค้าที่รอดำเนินการ", value: pendingReturnsCount },
  ].filter((c) => c.value !== null);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">สวัสดี, {session.user.name}</h1>
        <p className="text-muted-foreground">บทบาท: {ROLE_LABELS[role]}</p>
      </div>

      {cards.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((c) => (
            <Link key={c.href} href={c.href}>
              <Card className="transition-colors hover:bg-accent/50">
                <CardHeader className="pb-2">
                  <CardDescription>{c.label}</CardDescription>
                  <CardTitle className="text-3xl">{c.value}</CardTitle>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <p className="text-muted-foreground">ยังไม่มีข้อมูลสรุปสำหรับบทบาทนี้</p>
      )}
    </div>
  );
}
