import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { renderInvoicePdf } from "@/lib/invoice-pdf";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });
  if (getAccess(session.user.role, "billing") === "none") {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: { merchant: true, items: { orderBy: { id: "asc" } } },
  });
  if (!invoice) return new NextResponse("Not Found", { status: 404 });
  if (invoice.status === "DRAFT") {
    return new NextResponse("ต้องออกใบแจ้งหนี้ก่อนจึงจะดาวน์โหลด PDF ได้", { status: 400 });
  }

  const buffer = await renderInvoicePdf(invoice);
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${invoice.invoiceNo}.pdf"`,
    },
  });
}
