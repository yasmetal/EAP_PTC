import Link from "next/link";
import { requireAccess } from "@/lib/require-session";
import { canWrite, type RoleName } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { formatThaiDateTime } from "@/lib/format";
import { receiveStock } from "./actions";
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

export default async function InboundPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string; productId?: string; received?: string }>;
}) {
  const session = await requireAccess("inbound", "read");
  const role = session.user.role as RoleName;
  const canReceive = canWrite(role, "inbound");
  const { code, productId, received } = await searchParams;

  const matches =
    code && !productId
      ? await prisma.product.findMany({
          where: { OR: [{ barcode: code }, { sku: code }] },
          include: { merchant: { select: { name: true } } },
          take: 20,
        })
      : [];

  const selectedProduct = productId
    ? await prisma.product.findUnique({
        where: { id: productId },
        include: { merchant: { select: { name: true } } },
      })
    : matches.length === 1
      ? matches[0]
      : null;

  const locations = canReceive
    ? await prisma.location.findMany({ orderBy: [{ zone: "asc" }, { aisle: "asc" }, { binCode: "asc" }] })
    : [];

  const recentLogs = await prisma.activityLog.findMany({
    where: { action: "RECEIVE", entityType: "Inventory" },
    orderBy: { createdAt: "desc" },
    take: 10,
    include: { user: { select: { name: true } } },
  });
  const recentInventoryIds = recentLogs.map((l) => l.entityId);
  const recentInventory = recentInventoryIds.length
    ? await prisma.inventory.findMany({
        where: { id: { in: recentInventoryIds } },
        include: { product: true, location: true },
      })
    : [];
  const inventoryById = new Map(recentInventory.map((inv) => [inv.id, inv]));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">รับสินค้าเข้าคลัง (Inbound)</h1>
        <p className="text-muted-foreground">สแกนบาร์โค้ด หรือพิมพ์ SKU เพื่อค้นหาสินค้า</p>
      </div>

      {received === "1" && (
        <div className="rounded-md border border-green-600/30 bg-green-600/10 px-4 py-3 text-sm text-green-700 dark:text-green-400">
          รับสินค้าเข้าสต็อกสำเร็จ — สแกนรายการถัดไปได้เลย
        </div>
      )}

      {canReceive && (
        <Card>
          <CardContent className="pt-6">
            <form action="/inbound" className="flex items-end gap-2">
              <div className="flex-1 space-y-2">
                <Label htmlFor="code">บาร์โค้ด / SKU</Label>
                <Input id="code" name="code" autoFocus autoComplete="off" placeholder="สแกนที่นี่..." />
              </div>
              <Button type="submit">ค้นหา</Button>
            </form>
          </CardContent>
        </Card>
      )}

      {code && !selectedProduct && matches.length === 0 && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          ไม่พบสินค้าสำหรับโค้ด &quot;{code}&quot;
        </div>
      )}

      {code && !selectedProduct && matches.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle>พบสินค้าหลายรายการ — กรุณาเลือก</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {matches.map((m) => (
                <li key={m.id} className="py-2">
                  <Link
                    href={`/inbound?code=${encodeURIComponent(code)}&productId=${m.id}`}
                    className="hover:underline"
                  >
                    <span className="font-medium">{m.name}</span>{" "}
                    <span className="font-mono text-sm text-muted-foreground">({m.sku})</span> —{" "}
                    {m.merchant.name}
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {selectedProduct && canReceive && (
        <Card>
          <CardHeader>
            <CardTitle>{selectedProduct.name}</CardTitle>
            <p className="text-sm text-muted-foreground">
              SKU: <span className="font-mono">{selectedProduct.sku}</span> ·{" "}
              {selectedProduct.merchant.name}
            </p>
          </CardHeader>
          <CardContent>
            <form action={receiveStock} className="space-y-4">
              <input type="hidden" name="productId" value={selectedProduct.id} />
              <div className="space-y-2">
                <Label htmlFor="locationId">ตำแหน่งจัดเก็บ *</Label>
                <NativeSelect id="locationId" name="locationId" required>
                  {locations.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.binCode} ({loc.zone}/{loc.aisle})
                    </option>
                  ))}
                </NativeSelect>
              </div>
              <div className="space-y-2">
                <Label htmlFor="qty">จำนวนที่รับเข้า *</Label>
                <Input id="qty" name="qty" type="number" min="1" step="1" autoFocus required />
              </div>
              <Button type="submit">รับเข้าสต็อก</Button>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>ประวัติการรับเข้าล่าสุด</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>เวลา</TableHead>
                  <TableHead>พนักงาน</TableHead>
                  <TableHead>สินค้า</TableHead>
                  <TableHead>ตำแหน่ง</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentLogs.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      ยังไม่มีประวัติการรับเข้า
                    </TableCell>
                  </TableRow>
                )}
                {recentLogs.map((log) => {
                  const inv = inventoryById.get(log.entityId);
                  return (
                    <TableRow key={log.id}>
                      <TableCell>{formatThaiDateTime(log.createdAt)}</TableCell>
                      <TableCell>{log.user.name}</TableCell>
                      <TableCell>{inv ? `${inv.product.name} (${inv.product.sku})` : "-"}</TableCell>
                      <TableCell className="font-mono text-sm">{inv?.location.binCode ?? "-"}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
