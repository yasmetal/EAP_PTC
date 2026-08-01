import { requireAccess } from "@/lib/require-session";
import { prisma } from "@/lib/prisma";
import { createInvoice } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function NewInvoicePage() {
  await requireAccess("billing", "write");

  const merchants = await prisma.merchant.findMany({
    where: { status: "active" },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <h1 className="text-2xl font-semibold">สร้างใบแจ้งหนี้</h1>
      <Card>
        <CardHeader>
          <CardTitle>ข้อมูลรอบบิล</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createInvoice} className="space-y-4">
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
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="periodStart">เริ่มรอบบิล *</Label>
                <Input id="periodStart" name="periodStart" type="date" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="periodEnd">สิ้นสุดรอบบิล *</Label>
                <Input id="periodEnd" name="periodEnd" type="date" required />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              ระบบจะดึงออเดอร์ที่จัดส่งแล้วของ Merchant นี้ในช่วงเวลาที่เลือก มาสร้างเป็นรายการค่าบริการให้อัตโนมัติ
              (สามารถเพิ่ม/ลบรายการเองภายหลังได้ ก่อนออกใบแจ้งหนี้)
            </p>
            <Button type="submit">สร้างใบแจ้งหนี้ (ฉบับร่าง)</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
