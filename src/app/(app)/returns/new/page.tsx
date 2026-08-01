import Link from "next/link";
import { requireAccess } from "@/lib/require-session";
import { prisma } from "@/lib/prisma";
import { formatNumber } from "@/lib/format";
import { createReturn } from "../actions";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/native-select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function NewReturnPage({
  searchParams,
}: {
  searchParams: Promise<{ orderId?: string; error?: string }>;
}) {
  await requireAccess("returns", "write");
  const { orderId, error } = await searchParams;

  if (!orderId) {
    const orders = await prisma.order.findMany({
      where: { status: "SHIPPED" },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { merchant: { select: { name: true } } },
    });

    return (
      <div className="mx-auto max-w-xl space-y-6">
        <h1 className="text-2xl font-semibold">รับคืนสินค้า</h1>
        {error && (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}
        <Card>
          <CardHeader>
            <CardTitle>เลือกออเดอร์ที่ต้องการรับคืน</CardTitle>
          </CardHeader>
          <CardContent>
            {orders.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                ยังไม่มีออเดอร์ที่จัดส่งแล้วสำหรับรับคืนสินค้า
              </p>
            ) : (
              <form method="GET" className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="orderId">ออเดอร์ *</Label>
                  <NativeSelect id="orderId" name="orderId" required defaultValue="">
                    <option value="">-- เลือกออเดอร์ --</option>
                    {orders.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.customerName} — {o.merchant.name}
                      </option>
                    ))}
                  </NativeSelect>
                </div>
                <Button type="submit">ถัดไป</Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { merchant: { select: { name: true } }, items: { include: { product: true } } },
  });

  if (!order || order.status !== "SHIPPED") {
    return (
      <div className="mx-auto max-w-xl space-y-6">
        <h1 className="text-2xl font-semibold">รับคืนสินค้า</h1>
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          ไม่พบออเดอร์ หรือออเดอร์นี้ยังไม่ได้จัดส่ง
        </div>
        <Link href="/returns/new" className={buttonVariants({ variant: "outline" })}>
          ← เลือกออเดอร์ใหม่
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">รับคืนสินค้า: {order.customerName}</h1>
        <p className="text-muted-foreground">{order.merchant.name}</p>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>รายละเอียดการคืน</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createReturn} className="space-y-6">
            <input type="hidden" name="orderId" value={order.id} />
            <div className="space-y-2">
              <Label htmlFor="reason">เหตุผลการคืนสินค้า *</Label>
              <Textarea id="reason" name="reason" rows={2} required />
            </div>

            <div className="space-y-2">
              <Label>รายการสินค้าที่รับคืน</Label>
              <div className="space-y-3 rounded-md border p-3">
                {order.items.map((item) => (
                  <div
                    key={item.id}
                    className="grid grid-cols-12 gap-2 border-b pb-3 last:border-b-0 last:pb-0"
                  >
                    <div className="col-span-12 text-sm font-medium">
                      {item.product.sku} — {item.product.name}{" "}
                      <span className="text-muted-foreground">
                        (สั่งซื้อ {formatNumber(item.qty)} ชิ้น)
                      </span>
                    </div>
                    <div className="col-span-3 space-y-1">
                      <Label className="text-xs font-normal">จำนวนคืน</Label>
                      <Input
                        name={`items_${item.id}_qty`}
                        type="number"
                        min="0"
                        max={item.qty}
                        step="1"
                        placeholder="0"
                      />
                    </div>
                    <div className="col-span-5 space-y-1">
                      <Label className="text-xs font-normal">สภาพสินค้า</Label>
                      <Input name={`items_${item.id}_condition`} placeholder="เช่น สภาพดี, ชำรุด" />
                    </div>
                    <div className="col-span-4 space-y-1">
                      <Label className="text-xs font-normal">การดำเนินการ</Label>
                      <NativeSelect name={`items_${item.id}_action`} defaultValue="RESTOCK">
                        <option value="RESTOCK">นำกลับเข้าสต็อก</option>
                        <option value="DISPOSE">ทำลาย/ตัดสต็อก</option>
                      </NativeSelect>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                ระบุจำนวนเฉพาะรายการที่มีการคืนจริง รายการที่ไม่ระบุจำนวนจะถูกข้าม
              </p>
            </div>

            <Button type="submit">บันทึกการรับคืน</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
