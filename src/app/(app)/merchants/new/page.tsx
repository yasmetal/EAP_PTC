import { requireAccess } from "@/lib/require-session";
import { createMerchant } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/native-select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function NewMerchantPage() {
  await requireAccess("merchants", "write");

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <h1 className="text-2xl font-semibold">เพิ่ม Merchant</h1>
      <Card>
        <CardHeader>
          <CardTitle>ข้อมูลร้านค้า</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createMerchant} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">ชื่อร้านค้า *</Label>
              <Input id="name" name="name" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contactEmail">อีเมลติดต่อ *</Label>
              <Input id="contactEmail" name="contactEmail" type="email" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contactPhone">เบอร์โทรติดต่อ</Label>
              <Input id="contactPhone" name="contactPhone" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="billingTerms">เงื่อนไขค่าบริการ</Label>
              <Textarea id="billingTerms" name="billingTerms" rows={3} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">สถานะ</Label>
              <NativeSelect id="status" name="status" defaultValue="active">
                <option value="active">ใช้งาน</option>
                <option value="inactive">ปิดใช้งาน</option>
              </NativeSelect>
            </div>
            <Button type="submit">บันทึก</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
