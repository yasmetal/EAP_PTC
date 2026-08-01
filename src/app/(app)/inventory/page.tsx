import { requireAccess } from "@/lib/require-session";
import { canRead, type RoleName } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { formatThaiDate, formatNumber } from "@/lib/format";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export default async function InventoryPage() {
  const session = await requireAccess("inventory", "read");
  const role = session.user.role as RoleName;
  const showMerchant = canRead(role, "merchants");

  const inventory = await prisma.inventory.findMany({
    orderBy: [{ product: { name: "asc" } }, { location: { binCode: "asc" } }],
    include: { product: { include: { merchant: { select: { name: true } } } }, location: true },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">สต็อกสินค้า</h1>
        <p className="text-muted-foreground">
          มุมมองดูอย่างเดียว — ปรับสต็อกได้ผ่านหน้า &quot;รับสินค้าเข้า&quot; หรือระหว่างหยิบ-แพ็คออเดอร์
        </p>
      </div>

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>SKU</TableHead>
              <TableHead>ชื่อสินค้า</TableHead>
              {showMerchant && <TableHead>Merchant</TableHead>}
              <TableHead>ตำแหน่ง (Bin)</TableHead>
              <TableHead className="text-right">คงเหลือ</TableHead>
              <TableHead className="text-right">จองแล้ว</TableHead>
              <TableHead className="text-right">พร้อมขาย</TableHead>
              <TableHead>นับล่าสุด</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {inventory.length === 0 && (
              <TableRow>
                <TableCell colSpan={showMerchant ? 8 : 7} className="text-center text-muted-foreground">
                  ยังไม่มีข้อมูลสต็อก
                </TableCell>
              </TableRow>
            )}
            {inventory.map((inv) => {
              const available = inv.quantity - inv.reservedQty;
              return (
                <TableRow key={inv.id}>
                  <TableCell className="font-mono text-sm">{inv.product.sku}</TableCell>
                  <TableCell className="font-medium">{inv.product.name}</TableCell>
                  {showMerchant && <TableCell>{inv.product.merchant.name}</TableCell>}
                  <TableCell className="font-mono text-sm">{inv.location.binCode}</TableCell>
                  <TableCell className="text-right">{formatNumber(inv.quantity)}</TableCell>
                  <TableCell className="text-right">{formatNumber(inv.reservedQty)}</TableCell>
                  <TableCell className="text-right">
                    <Badge variant={available <= 10 ? "destructive" : "outline"}>
                      {formatNumber(available)}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatThaiDate(inv.lastCountedAt)}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
