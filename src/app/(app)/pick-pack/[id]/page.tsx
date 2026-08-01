import { notFound } from "next/navigation";
import { requireAccess } from "@/lib/require-session";
import { canWrite, type RoleName } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { PICKLIST_STATUS_LABELS } from "@/lib/labels";
import { scanPickItem, setPickedQty, completePacking } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function PickPackDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ scan?: string; error?: string }>;
}) {
  const { id } = await params;
  const { scan, error } = await searchParams;
  const session = await requireAccess("pickpack", "read");
  const role = session.user.role as RoleName;
  const canWork = canWrite(role, "pickpack");

  const pickList = await prisma.pickList.findUnique({
    where: { id },
    include: {
      order: { include: { merchant: { select: { name: true } } } },
      items: {
        include: { orderItem: { include: { product: true } }, location: true },
      },
    },
  });

  if (!pickList) notFound();

  const scanWithId = scanPickItem.bind(null, pickList.id);
  const completeWithId = completePacking.bind(null, pickList.id);
  const allComplete = pickList.items.every((it) => it.pickedQty >= it.orderItem.qty);
  const isDone = pickList.status === "COMPLETED";

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">หยิบสินค้า: {pickList.order.customerName}</h1>
          <p className="text-muted-foreground">{pickList.order.merchant.name}</p>
        </div>
        <Badge variant="secondary">{PICKLIST_STATUS_LABELS[pickList.status]}</Badge>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}
      {scan === "ok" && (
        <div className="rounded-md border border-green-600/30 bg-green-600/10 px-4 py-3 text-sm text-green-700 dark:text-green-400">
          สแกนสำเร็จ
        </div>
      )}
      {scan === "notfound" && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          ไม่พบสินค้านี้ในใบหยิบ หรือหยิบครบแล้ว
        </div>
      )}

      {canWork && !isDone && (
        <Card>
          <CardContent className="pt-6">
            <form action={scanWithId} className="flex items-end gap-2">
              <div className="flex-1 space-y-2">
                <Label htmlFor="code">สแกนบาร์โค้ด / SKU สินค้า</Label>
                <Input id="code" name="code" autoFocus autoComplete="off" placeholder="สแกนที่นี่..." />
              </div>
              <Button type="submit">ยืนยัน</Button>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>รายการที่ต้องหยิบ</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {pickList.items.map((item) => {
            const target = item.orderItem.qty;
            const complete = item.pickedQty >= target;
            const updateQtyWithId = setPickedQty.bind(null, item.id);
            return (
              <div
                key={item.id}
                className={`flex flex-wrap items-center justify-between gap-3 rounded-md border p-3 ${complete ? "border-green-600/40 bg-green-600/5" : ""}`}
              >
                <div>
                  <p className="font-medium">{item.orderItem.product.name}</p>
                  <p className="text-sm text-muted-foreground">
                    SKU: <span className="font-mono">{item.orderItem.product.sku}</span> · ตำแหน่ง:{" "}
                    <span className="font-mono">{item.location.binCode}</span>
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-lg font-semibold ${complete ? "text-green-700 dark:text-green-400" : ""}`}>
                    {item.pickedQty} / {target}
                  </span>
                  {canWork && !isDone && (
                    <form action={updateQtyWithId} className="flex items-center gap-1">
                      <Input
                        name="qty"
                        type="number"
                        min="0"
                        max={target}
                        defaultValue={item.pickedQty}
                        className="w-16"
                      />
                      <Button type="submit" size="sm" variant="outline">
                        ปรับ
                      </Button>
                    </form>
                  )}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {canWork && !isDone && (
        <form action={completeWithId}>
          <Button type="submit" disabled={!allComplete} className="w-full" size="lg">
            แพ็คเสร็จ — ตัดสต็อกจริง
          </Button>
        </form>
      )}
    </div>
  );
}
