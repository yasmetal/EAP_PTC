import Link from "next/link";
import { requireAccess } from "@/lib/require-session";
import { canWrite, type RoleName } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { formatThaiDate, formatBaht } from "@/lib/format";
import { INVOICE_STATUS_LABELS, INVOICE_STATUS_BADGE } from "@/lib/labels";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function BillingPage() {
  const session = await requireAccess("billing", "read");
  const role = session.user.role as RoleName;
  const canManage = canWrite(role, "billing");

  const invoices = await prisma.invoice.findMany({
    orderBy: { createdAt: "desc" },
    include: { merchant: { select: { name: true } } },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">ใบแจ้งหนี้ / บิล</h1>
          <p className="text-muted-foreground">รายการใบแจ้งหนี้ค่าบริการทั้งหมด</p>
        </div>
        {canManage && (
          <Link href="/billing/new" className={buttonVariants()}>
            + สร้างใบแจ้งหนี้
          </Link>
        )}
      </div>

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>เลขที่ใบแจ้งหนี้</TableHead>
              <TableHead>Merchant</TableHead>
              <TableHead>รอบบิล</TableHead>
              <TableHead className="text-right">ยอดรวม</TableHead>
              <TableHead>สถานะ</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  ยังไม่มีใบแจ้งหนี้
                </TableCell>
              </TableRow>
            )}
            {invoices.map((inv) => (
              <TableRow key={inv.id}>
                <TableCell className="font-mono text-sm">
                  <Link href={`/billing/${inv.id}`} className="hover:underline">
                    {inv.invoiceNo}
                  </Link>
                </TableCell>
                <TableCell>{inv.merchant.name}</TableCell>
                <TableCell>
                  {formatThaiDate(inv.periodStart)} – {formatThaiDate(inv.periodEnd)}
                </TableCell>
                <TableCell className="text-right">{formatBaht(inv.totalAmount.toString())}</TableCell>
                <TableCell>
                  <Badge variant={INVOICE_STATUS_BADGE[inv.status]}>
                    {INVOICE_STATUS_LABELS[inv.status]}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
