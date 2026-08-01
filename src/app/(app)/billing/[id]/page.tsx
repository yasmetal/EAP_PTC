import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAccess } from "@/lib/require-session";
import { canWrite, type RoleName } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { formatThaiDate, formatBaht } from "@/lib/format";
import { INVOICE_STATUS_LABELS, INVOICE_STATUS_BADGE } from "@/lib/labels";
import { addInvoiceItem, deleteInvoiceItem, issueInvoice, markInvoicePaid } from "../actions";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

export default async function InvoiceDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const session = await requireAccess("billing", "read");
  const role = session.user.role as RoleName;
  const canManage = canWrite(role, "billing");

  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: { merchant: true, items: { orderBy: { id: "asc" } } },
  });

  if (!invoice) notFound();

  const isDraft = invoice.status === "DRAFT";
  const addItemWithId = addInvoiceItem.bind(null, invoice.id);
  const issueWithId = issueInvoice.bind(null, invoice.id);
  const payWithId = markInvoicePaid.bind(null, invoice.id);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">ใบแจ้งหนี้ {invoice.invoiceNo}</h1>
          <p className="text-muted-foreground">
            <Link href={`/merchants/${invoice.merchantId}`} className="hover:underline">
              {invoice.merchant.name}
            </Link>{" "}
            · รอบบิล {formatThaiDate(invoice.periodStart)} – {formatThaiDate(invoice.periodEnd)}
          </p>
        </div>
        <Badge variant={INVOICE_STATUS_BADGE[invoice.status]}>
          {INVOICE_STATUS_LABELS[invoice.status]}
        </Badge>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {canManage && (
        <div className="flex flex-wrap gap-2">
          {isDraft && (
            <form action={issueWithId}>
              <Button type="submit">ออกใบแจ้งหนี้</Button>
            </form>
          )}
          {invoice.status === "ISSUED" && (
            <form action={payWithId}>
              <Button type="submit">บันทึกว่าชำระแล้ว</Button>
            </form>
          )}
          {!isDraft && (
            <a href={`/api/invoices/${invoice.id}/pdf`} className={buttonVariants({ variant: "outline" })}>
              ดาวน์โหลด PDF
            </a>
          )}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>รายการค่าบริการ</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>รายละเอียด</TableHead>
                  <TableHead className="text-right">จำนวน</TableHead>
                  <TableHead className="text-right">ราคา/หน่วย</TableHead>
                  <TableHead className="text-right">รวม</TableHead>
                  {canManage && isDraft && <TableHead />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoice.items.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={canManage && isDraft ? 5 : 4} className="text-center text-muted-foreground">
                      ยังไม่มีรายการ
                    </TableCell>
                  </TableRow>
                )}
                {invoice.items.map((item) => {
                  const deleteWithIds = deleteInvoiceItem.bind(null, invoice.id, item.id);
                  return (
                    <TableRow key={item.id}>
                      <TableCell>{item.description}</TableCell>
                      <TableCell className="text-right">{item.qty}</TableCell>
                      <TableCell className="text-right">{formatBaht(item.unitPrice.toString())}</TableCell>
                      <TableCell className="text-right">{formatBaht(item.amount.toString())}</TableCell>
                      {canManage && isDraft && (
                        <TableCell className="text-right">
                          <form action={deleteWithIds}>
                            <Button type="submit" variant="ghost" size="sm">
                              ลบ
                            </Button>
                          </form>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          <p className="mt-3 text-right font-medium">
            รวมทั้งสิ้น: {formatBaht(invoice.totalAmount.toString())}
          </p>
        </CardContent>
      </Card>

      {canManage && isDraft && (
        <Card>
          <CardHeader>
            <CardTitle>เพิ่มรายการ</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={addItemWithId} className="grid gap-4 sm:grid-cols-4 sm:items-end">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="description">รายละเอียด *</Label>
                <Input id="description" name="description" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="qty">จำนวน *</Label>
                <Input id="qty" name="qty" type="number" min="1" step="1" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="unitPrice">ราคา/หน่วย *</Label>
                <Input id="unitPrice" name="unitPrice" type="number" min="0" step="0.01" required />
              </div>
              <Button type="submit" className="sm:col-span-4 sm:w-fit">
                เพิ่มรายการ
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
