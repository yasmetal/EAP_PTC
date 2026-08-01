import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAccess } from "@/lib/require-session";
import { canWrite, type RoleName } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { formatThaiDateTime, formatNumber } from "@/lib/format";
import { RETURN_STATUS_LABELS, RETURN_STATUS_BADGE, RETURN_ACTION_LABELS } from "@/lib/labels";
import { startInspecting, resolveReturn } from "../actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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

export default async function ReturnDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const session = await requireAccess("returns", "read");
  const role = session.user.role as RoleName;
  const canManage = canWrite(role, "returns");

  const ret = await prisma.return.findUnique({
    where: { id },
    include: {
      order: { include: { merchant: { select: { id: true, name: true } } } },
      items: { include: { product: true } },
    },
  });
  if (!ret) notFound();

  const locations = ret.items.some((it) => it.action === "RESTOCK")
    ? await prisma.location.findMany({ orderBy: { binCode: "asc" } })
    : [];

  const startInspectingWithId = startInspecting.bind(null, ret.id);
  const resolveWithId = resolveReturn.bind(null, ret.id);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">การคืนสินค้า: {ret.order.customerName}</h1>
          <p className="text-muted-foreground">
            <Link href={`/orders/${ret.order.id}`} className="hover:underline">
              ดูออเดอร์ต้นทาง
            </Link>{" "}
            · {ret.order.merchant.name} · รับคืนเมื่อ {formatThaiDateTime(ret.receivedAt)}
          </p>
        </div>
        <Badge variant={RETURN_STATUS_BADGE[ret.status]}>{RETURN_STATUS_LABELS[ret.status]}</Badge>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {canManage && ret.status === "RECEIVED" && (
        <form action={startInspectingWithId}>
          <Button type="submit">เริ่มตรวจสอบ</Button>
        </form>
      )}

      <Card>
        <CardHeader>
          <CardTitle>เหตุผลการคืนสินค้า</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="whitespace-pre-wrap text-sm">{ret.reason}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>รายการสินค้า</CardTitle>
        </CardHeader>
        <CardContent>
          {canManage && ret.status === "INSPECTING" ? (
            <form action={resolveWithId} className="space-y-4">
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>SKU</TableHead>
                      <TableHead>สินค้า</TableHead>
                      <TableHead className="text-right">จำนวน</TableHead>
                      <TableHead>สภาพ</TableHead>
                      <TableHead>การดำเนินการ</TableHead>
                      <TableHead>ตำแหน่งจัดเก็บ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ret.items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-mono text-sm">{item.product.sku}</TableCell>
                        <TableCell>{item.product.name}</TableCell>
                        <TableCell className="text-right">{formatNumber(item.qty)}</TableCell>
                        <TableCell>{item.condition}</TableCell>
                        <TableCell>{RETURN_ACTION_LABELS[item.action]}</TableCell>
                        <TableCell>
                          {item.action === "RESTOCK" ? (
                            <NativeSelect name={`location_${item.id}`} required defaultValue="">
                              <option value="">-- เลือก --</option>
                              {locations.map((loc) => (
                                <option key={loc.id} value={loc.id}>
                                  {loc.binCode}
                                </option>
                              ))}
                            </NativeSelect>
                          ) : (
                            "-"
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <Button type="submit">ยืนยันผลตรวจสอบ (Resolve)</Button>
            </form>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>SKU</TableHead>
                    <TableHead>สินค้า</TableHead>
                    <TableHead className="text-right">จำนวน</TableHead>
                    <TableHead>สภาพ</TableHead>
                    <TableHead>การดำเนินการ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ret.items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-mono text-sm">{item.product.sku}</TableCell>
                      <TableCell>{item.product.name}</TableCell>
                      <TableCell className="text-right">{formatNumber(item.qty)}</TableCell>
                      <TableCell>{item.condition}</TableCell>
                      <TableCell>{RETURN_ACTION_LABELS[item.action]}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
