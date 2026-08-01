import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAccess } from "@/lib/require-session";
import { canRead, canWrite, type RoleName } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { formatThaiDate } from "@/lib/format";
import { updateMerchant } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/native-select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function MerchantDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireAccess("merchants", "read");
  const role = session.user.role as RoleName;
  const canManage = canWrite(role, "merchants");

  const merchant = await prisma.merchant.findUnique({
    where: { id },
    include: {
      products: canRead(role, "products")
        ? { orderBy: { createdAt: "desc" }, take: 20 }
        : false,
    },
  });

  if (!merchant) notFound();

  const updateMerchantWithId = updateMerchant.bind(null, merchant.id);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{merchant.name}</h1>
          <p className="text-muted-foreground">สร้างเมื่อ {formatThaiDate(merchant.createdAt)}</p>
        </div>
        <Badge variant={merchant.status === "active" ? "default" : "secondary"}>
          {merchant.status === "active" ? "ใช้งาน" : "ปิดใช้งาน"}
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>ข้อมูลร้านค้า</CardTitle>
        </CardHeader>
        <CardContent>
          {canManage ? (
            <form action={updateMerchantWithId} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">ชื่อร้านค้า *</Label>
                <Input id="name" name="name" defaultValue={merchant.name} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contactEmail">อีเมลติดต่อ *</Label>
                <Input
                  id="contactEmail"
                  name="contactEmail"
                  type="email"
                  defaultValue={merchant.contactEmail}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contactPhone">เบอร์โทรติดต่อ</Label>
                <Input
                  id="contactPhone"
                  name="contactPhone"
                  defaultValue={merchant.contactPhone ?? ""}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="billingTerms">เงื่อนไขค่าบริการ</Label>
                <Textarea
                  id="billingTerms"
                  name="billingTerms"
                  rows={3}
                  defaultValue={merchant.billingTerms ?? ""}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">สถานะ</Label>
                <NativeSelect id="status" name="status" defaultValue={merchant.status}>
                  <option value="active">ใช้งาน</option>
                  <option value="inactive">ปิดใช้งาน</option>
                </NativeSelect>
              </div>
              <Button type="submit">บันทึกการแก้ไข</Button>
            </form>
          ) : (
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-sm text-muted-foreground">อีเมลติดต่อ</dt>
                <dd>{merchant.contactEmail}</dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">เบอร์โทรติดต่อ</dt>
                <dd>{merchant.contactPhone || "-"}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-sm text-muted-foreground">เงื่อนไขค่าบริการ</dt>
                <dd className="whitespace-pre-wrap">{merchant.billingTerms || "-"}</dd>
              </div>
            </dl>
          )}
        </CardContent>
      </Card>

      {canRead(role, "products") && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>สินค้า (SKU)</CardTitle>
            <Link href={`/products?merchantId=${merchant.id}`} className="text-sm hover:underline">
              ดูทั้งหมด →
            </Link>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>SKU</TableHead>
                    <TableHead>ชื่อสินค้า</TableHead>
                    <TableHead>หมวดหมู่</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {merchant.products && merchant.products.length > 0 ? (
                    merchant.products.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-mono text-sm">{p.sku}</TableCell>
                        <TableCell>
                          <Link href={`/products/${p.id}`} className="hover:underline">
                            {p.name}
                          </Link>
                        </TableCell>
                        <TableCell>{p.category || "-"}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-muted-foreground">
                        ยังไม่มีสินค้า
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
