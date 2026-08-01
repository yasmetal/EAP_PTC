import Link from "next/link";
import { requireAccess } from "@/lib/require-session";
import { canRead, canWrite, type RoleName } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { buttonVariants } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ merchantId?: string }>;
}) {
  const { merchantId } = await searchParams;
  const session = await requireAccess("products", "read");
  const role = session.user.role as RoleName;
  const canManage = canWrite(role, "products");
  const canViewMerchants = canRead(role, "merchants");

  const [products, filterMerchant] = await Promise.all([
    prisma.product.findMany({
      where: merchantId ? { merchantId } : undefined,
      orderBy: { createdAt: "desc" },
      include: { merchant: { select: { id: true, name: true } } },
    }),
    merchantId
      ? prisma.merchant.findUnique({ where: { id: merchantId }, select: { name: true } })
      : null,
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">สินค้า (SKU)</h1>
          <p className="text-muted-foreground">
            {filterMerchant ? (
              <>
                กรองตาม Merchant: {filterMerchant.name}{" "}
                <Link href="/products" className="text-sm hover:underline">
                  (ล้างตัวกรอง)
                </Link>
              </>
            ) : (
              "รายการสินค้าทั้งหมดทุก Merchant"
            )}
          </p>
        </div>
        {canManage && (
          <Link href="/products/new" className={buttonVariants()}>
            + เพิ่มสินค้า
          </Link>
        )}
      </div>

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>SKU</TableHead>
              <TableHead>ชื่อสินค้า</TableHead>
              <TableHead>Merchant</TableHead>
              <TableHead>บาร์โค้ด</TableHead>
              <TableHead>หมวดหมู่</TableHead>
              <TableHead className="text-right">น้ำหนัก (กก.)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  ยังไม่มีข้อมูลสินค้า
                </TableCell>
              </TableRow>
            )}
            {products.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-mono text-sm">{p.sku}</TableCell>
                <TableCell className="font-medium">
                  <Link href={`/products/${p.id}`} className="hover:underline">
                    {p.name}
                  </Link>
                </TableCell>
                <TableCell>
                  {canViewMerchants ? (
                    <Link href={`/merchants/${p.merchant.id}`} className="hover:underline">
                      {p.merchant.name}
                    </Link>
                  ) : (
                    p.merchant.name
                  )}
                </TableCell>
                <TableCell className="font-mono text-sm">{p.barcode || "-"}</TableCell>
                <TableCell>{p.category || "-"}</TableCell>
                <TableCell className="text-right">{p.weightKg ?? "-"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
