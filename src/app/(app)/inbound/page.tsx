import Link from "next/link";
import { requireAccess } from "@/lib/require-session";
import { canWrite, type RoleName } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { formatThaiDateTime } from "@/lib/format";
import { INBOUND_MAX_ROWS } from "@/lib/inbound-excel";
import { receiveStock } from "./actions";
import { InboundImportForm } from "./import-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  searchParams: Promise<{
    code?: string;
    productId?: string;
    received?: string;
    merchantId?: string;
  }>;
}) {
  const session = await requireAccess("inbound", "read");
  const role = session.user.role as RoleName;
  const canReceive = canWrite(role, "inbound");
  const { code, productId, received, merchantId } = await searchParams;

  const merchants = await prisma.merchant.findMany({
    where: { status: "active" },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  const selectedMerchant = merchantId ? merchants.find((m) => m.id === merchantId) : undefined;

  const matches =
    code && !productId
      ? await prisma.product.findMany({
          where: {
            OR: [{ barcode: code }, { sku: code }],
            ...(selectedMerchant ? { merchantId: selectedMerchant.id } : {}),
          },
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
        include: {
          product: { include: { merchant: { select: { name: true } } } },
          location: true,
        },
      })
    : [];
  const inventoryById = new Map(recentInventory.map((inv) => [inv.id, inv]));

  const keepMerchant = selectedMerchant ? `&merchantId=${selectedMerchant.id}` : "";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">รับสินค้าเข้าคลัง (Inbound)</h1>
        <p className="text-muted-foreground">
          สแกนบาร์โค้ด พิมพ์ SKU เพื่อค้นหาสินค้า หรือนำเข้าหลายรายการพร้อมกันด้วยไฟล์ Excel
        </p>
      </div>

      {received === "1" && (
        <div className="rounded-md border border-green-600/30 bg-green-600/10 px-4 py-3 text-sm text-green-700 dark:text-green-400">
          รับสินค้าเข้าสต็อกสำเร็จ — สแกนรายการถัดไปได้เลย
        </div>
      )}

      {canReceive && (
        <Card>
          <CardHeader>
            <CardTitle>ค้นหาสินค้าทีละรายการ</CardTitle>
            <CardDescription>
              เลือกร้านค้าที่ใช้บริการก่อน จะช่วยกรองกรณีหลายร้านใช้ SKU ซ้ำกัน
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action="/inbound" className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="space-y-2 sm:w-64">
                <Label htmlFor="merchantId">ร้านค้าที่ใช้บริการ</Label>
                <NativeSelect id="merchantId" name="merchantId" defaultValue={merchantId ?? ""}>
                  <option value="">ทุกร้านค้า</option>
                  {merchants.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </NativeSelect>
              </div>
              <div className="flex-1 space-y-2">
                <Label htmlFor="code">บาร์โค้ด / SKU</Label>
                <Input
                  id="code"
                  name="code"
                  autoFocus
                  autoComplete="off"
                  defaultValue={code ?? ""}
                  placeholder="สแกนที่นี่..."
                />
              </div>
              <Button type="submit">ค้นหา</Button>
            </form>
          </CardContent>
        </Card>
      )}

      {canReceive && (
        <Card>
          <CardHeader>
            <CardTitle>นำเข้าจากไฟล์ Excel</CardTitle>
            <CardDescription>
              เหมาะกับการรับของเข้าล็อตใหญ่ — ไฟล์ต้องระบุชื่อร้านค้า, SKU หรือบาร์โค้ด,
              รหัสตำแหน่งจัดเก็บ และจำนวน
            </CardDescription>
          </CardHeader>
          <CardContent>
            <InboundImportForm maxRows={INBOUND_MAX_ROWS} />
          </CardContent>
        </Card>
      )}

      {code && !selectedProduct && matches.length === 0 && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          ไม่พบสินค้าสำหรับโค้ด &quot;{code}&quot;
          {selectedMerchant && <> ในร้าน &quot;{selectedMerchant.name}&quot;</>}
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
                    href={`/inbound?code=${encodeURIComponent(code)}&productId=${m.id}${keepMerchant}`}
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
            <CardDescription>
              ร้านค้า: <span className="font-medium text-foreground">{selectedProduct.merchant.name}</span>
              {" · "}SKU: <span className="font-mono">{selectedProduct.sku}</span>
              {selectedProduct.barcode && (
                <>
                  {" · "}บาร์โค้ด: <span className="font-mono">{selectedProduct.barcode}</span>
                </>
              )}
            </CardDescription>
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
                  <TableHead>ร้านค้า</TableHead>
                  <TableHead>สินค้า</TableHead>
                  <TableHead>ตำแหน่ง</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentLogs.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
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
                      <TableCell>{inv?.product.merchant.name ?? "-"}</TableCell>
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
