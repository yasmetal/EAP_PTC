import { requireAccess } from "@/lib/require-session";
import { prisma } from "@/lib/prisma";
import { MAX_ORDER_ITEM_ROWS } from "@/lib/validation";
import { createOrder } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/native-select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function NewOrderPage() {
  await requireAccess("orders", "write");

  const [merchants, products] = await Promise.all([
    prisma.merchant.findMany({
      where: { status: "active" },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.product.findMany({
      orderBy: { sku: "asc" },
      select: { id: true, sku: true, name: true },
    }),
  ]);

  const itemRows = Array.from({ length: MAX_ORDER_ITEM_ROWS });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-2xl font-semibold">สร้างออเดอร์</h1>
      <Card>
        <CardHeader>
          <CardTitle>ข้อมูลออเดอร์</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createOrder} className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="merchantId">Merchant *</Label>
                <NativeSelect id="merchantId" name="merchantId" required>
                  <option value="">-- เลือก --</option>
                  {merchants.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </NativeSelect>
              </div>
              <div className="space-y-2">
                <Label htmlFor="channel">ช่องทางการขาย *</Label>
                <Input id="channel" name="channel" placeholder="เช่น Shopee, Lazada, เว็บไซต์" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="externalOrderNo">เลขที่ออเดอร์อ้างอิง</Label>
                <Input id="externalOrderNo" name="externalOrderNo" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="customerName">ชื่อลูกค้า *</Label>
                <Input id="customerName" name="customerName" required />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="customerAddress">ที่อยู่จัดส่ง *</Label>
              <Textarea id="customerAddress" name="customerAddress" rows={3} required />
            </div>

            <div className="space-y-2">
              <Label>รายการสินค้า *</Label>
              <div className="space-y-2 rounded-md border p-3">
                {itemRows.map((_, i) => (
                  <div key={i} className="grid grid-cols-12 gap-2">
                    <div className="col-span-6">
                      <NativeSelect name={`items_${i}_productId`} defaultValue="">
                        <option value="">-- ไม่เลือก --</option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.sku} — {p.name}
                          </option>
                        ))}
                      </NativeSelect>
                    </div>
                    <div className="col-span-3">
                      <Input
                        name={`items_${i}_qty`}
                        type="number"
                        min="1"
                        step="1"
                        placeholder="จำนวน"
                      />
                    </div>
                    <div className="col-span-3">
                      <Input
                        name={`items_${i}_unitPrice`}
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="ราคา/หน่วย"
                      />
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                เลือกสินค้าเฉพาะแถวที่ต้องการ แถวที่ไม่เลือกสินค้าจะถูกข้าม
              </p>
            </div>

            <Button type="submit">สร้างออเดอร์</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
