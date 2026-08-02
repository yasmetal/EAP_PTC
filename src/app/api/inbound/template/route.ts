import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { buildInboundTemplate, INBOUND_TEMPLATE_FILENAME } from "@/lib/inbound-excel";

export async function GET() {
  const session = await auth();
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });
  if (getAccess(session.user.role, "inbound") !== "write") {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const [merchants, locations, sampleProduct] = await Promise.all([
    prisma.merchant.findMany({
      where: { status: "active" },
      select: { name: true, contactEmail: true },
      orderBy: { name: "asc" },
    }),
    prisma.location.findMany({
      select: { binCode: true, zone: true, aisle: true },
      orderBy: [{ zone: "asc" }, { aisle: "asc" }, { binCode: "asc" }],
    }),
    prisma.product.findFirst({
      select: { sku: true, name: true, barcode: true, merchant: { select: { name: true } } },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const file = await buildInboundTemplate({
    merchants,
    locations,
    sample: sampleProduct
      ? {
          merchant: sampleProduct.merchant.name,
          sku: sampleProduct.sku,
          barcode: sampleProduct.barcode ?? "",
          productName: sampleProduct.name,
          binCode: locations[0]?.binCode ?? "A-01-01",
        }
      : null,
  });

  return new NextResponse(file, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${INBOUND_TEMPLATE_FILENAME}"`,
      "Cache-Control": "no-store",
    },
  });
}
