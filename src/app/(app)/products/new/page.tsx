import { requireAccess } from "@/lib/require-session";
import { prisma } from "@/lib/prisma";
import { createProduct } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function NewProductPage({
  searchParams,
}: {
  searchParams: Promise<{ merchantId?: string }>;
}) {
  await requireAccess("products", "write");
  const { merchantId } = await searchParams;

  const merchants = await prisma.merchant.findMany({
    where: { status: "active" },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <h1 className="text-2xl font-semibold">เพิ่มสินค้า</h1>
      <Card>
        <CardHeader>
          <CardTitle>ข้อมูลสินค้า</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createProduct} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="merchantId">Merchant *</Label>
              <NativeSelect id="merchantId" name="merchantId" defaultValue={merchantId ?? ""} required>
                <option value="" disabled>
                  เลือก Merchant
                </option>
                {merchants.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="space-y-2">
              <Label htmlFor="sku">SKU *</Label>
              <Input id="sku" name="sku" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">ชื่อสินค้า *</Label>
              <Input id="name" name="name" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="barcode">บาร์โค้ด</Label>
              <Input id="barcode" name="barcode" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="category">หมวดหมู่</Label>
              <Input id="category" name="category" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="weightKg">น้ำหนัก (กก.)</Label>
              <Input id="weightKg" name="weightKg" type="number" step="0.01" min="0" />
            </div>
            <Button type="submit">บันทึก</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
