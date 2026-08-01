import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAccess } from "@/lib/require-session";
import { canRead, canWrite, type RoleName } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { formatThaiDate, formatNumber } from "@/lib/format";
import { updateProduct } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireAccess("products", "read");
  const role = session.user.role as RoleName;
  const canManage = canWrite(role, "products");
  const canViewInventory = canRead(role, "inventory");
  const canViewMerchants = canRead(role, "merchants");

  const [product, merchants] = await Promise.all([
    prisma.product.findUnique({
      where: { id },
      include: {
        merchant: { select: { id: true, name: true } },
        inventory: { include: { location: true } },
      },
    }),
    canManage
      ? prisma.merchant.findMany({
          where: { status: "active" },
          orderBy: { name: "asc" },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
  ]);

  if (!product) notFound();

  const updateProductWithId = updateProduct.bind(null, product.id);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{product.name}</h1>
        <p className="text-muted-foreground">
          SKU: <span className="font-mono">{product.sku}</span> · สร้างเมื่อ{" "}
          {formatThaiDate(product.createdAt)}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>ข้อมูลสินค้า</CardTitle>
        </CardHeader>
        <CardContent>
          {canManage ? (
            <form action={updateProductWithId} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="merchantId">Merchant *</Label>
                <NativeSelect
                  id="merchantId"
                  name="merchantId"
                  defaultValue={product.merchantId}
                  required
                >
                  {merchants.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </NativeSelect>
              </div>
              <div className="space-y-2">
                <Label htmlFor="sku">SKU *</Label>
                <Input id="sku" name="sku" defaultValue={product.sku} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">ชื่อสินค้า *</Label>
                <Input id="name" name="name" defaultValue={product.name} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="barcode">บาร์โค้ด</Label>
                <Input id="barcode" name="barcode" defaultValue={product.barcode ?? ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">หมวดหมู่</Label>
                <Input id="category" name="category" defaultValue={product.category ?? ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="weightKg">น้ำหนัก (กก.)</Label>
                <Input
                  id="weightKg"
                  name="weightKg"
                  type="number"
                  step="0.01"
                  min="0"
                  defaultValue={product.weightKg ?? ""}
                />
              </div>
              <Button type="submit">บันทึกการแก้ไข</Button>
            </form>
          ) : (
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-sm text-muted-foreground">Merchant</dt>
                <dd>
                  {canViewMerchants ? (
                    <Link href={`/merchants/${product.merchant.id}`} className="hover:underline">
                      {product.merchant.name}
                    </Link>
                  ) : (
                    product.merchant.name
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">บาร์โค้ด</dt>
                <dd className="font-mono">{product.barcode || "-"}</dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">หมวดหมู่</dt>
                <dd>{product.category || "-"}</dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">น้ำหนัก</dt>
                <dd>{product.weightKg ? `${product.weightKg} กก.` : "-"}</dd>
              </div>
            </dl>
          )}
        </CardContent>
      </Card>

      {canViewInventory && (
        <Card>
          <CardHeader>
            <CardTitle>สต็อกตามตำแหน่ง</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ตำแหน่ง (Bin)</TableHead>
                    <TableHead className="text-right">จำนวนคงเหลือ</TableHead>
                    <TableHead className="text-right">จองแล้ว</TableHead>
                    <TableHead className="text-right">พร้อมขาย</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {product.inventory && product.inventory.length > 0 ? (
                    product.inventory.map((inv) => (
                      <TableRow key={inv.id}>
                        <TableCell className="font-mono text-sm">{inv.location.binCode}</TableCell>
                        <TableCell className="text-right">{formatNumber(inv.quantity)}</TableCell>
                        <TableCell className="text-right">{formatNumber(inv.reservedQty)}</TableCell>
                        <TableCell className="text-right">
                          {formatNumber(inv.quantity - inv.reservedQty)}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground">
                        ยังไม่มีสต็อกสำหรับสินค้านี้
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
