"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAccess } from "@/lib/require-session";
import { logActivity } from "@/lib/activity-log";
import { invoiceCreateSchema, invoiceItemInputSchema } from "@/lib/validation";
import { FULFILLMENT_FEE_PER_UNIT, generateInvoiceNo } from "@/lib/billing";

export async function createInvoice(formData: FormData) {
  const session = await requireAccess("billing", "write");

  const data = invoiceCreateSchema.parse({
    merchantId: formData.get("merchantId"),
    periodStart: formData.get("periodStart"),
    periodEnd: formData.get("periodEnd"),
  });

  const periodStart = new Date(data.periodStart);
  const periodEnd = new Date(data.periodEnd);
  periodEnd.setHours(23, 59, 59, 999);

  const invoice = await prisma.$transaction(async (tx) => {
    const shippedOrders = await tx.order.findMany({
      where: {
        merchantId: data.merchantId,
        status: "SHIPPED",
        shipments: { some: { shippedAt: { gte: periodStart, lte: periodEnd } } },
      },
      include: { items: true },
    });

    const items = shippedOrders.map((order) => {
      const qty = order.items.reduce((sum, item) => sum + item.qty, 0);
      return {
        description: `ค่าบริการจัดการออเดอร์ #${order.id.slice(0, 8)} — ${order.customerName}`,
        qty,
        unitPrice: FULFILLMENT_FEE_PER_UNIT,
        amount: qty * FULFILLMENT_FEE_PER_UNIT,
      };
    });

    const totalAmount = items.reduce((sum, item) => sum + item.amount, 0);
    const invoiceNo = await generateInvoiceNo(tx);

    const created = await tx.invoice.create({
      data: {
        merchantId: data.merchantId,
        invoiceNo,
        periodStart,
        periodEnd,
        totalAmount,
        status: "DRAFT",
        items: { create: items },
      },
    });

    await logActivity(
      { userId: session.user.id, action: "CREATE", entityType: "Invoice", entityId: created.id },
      tx
    );

    return created;
  });

  revalidatePath("/billing");
  redirect(`/billing/${invoice.id}`);
}

export async function addInvoiceItem(invoiceId: string, formData: FormData) {
  const session = await requireAccess("billing", "write");

  const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
  if (!invoice) redirect("/billing");
  if (invoice.status !== "DRAFT") {
    redirect(`/billing/${invoiceId}?error=${encodeURIComponent("แก้ไขรายการได้เฉพาะใบแจ้งหนี้ที่เป็นฉบับร่างเท่านั้น")}`);
  }

  const data = invoiceItemInputSchema.parse({
    description: formData.get("description"),
    qty: formData.get("qty"),
    unitPrice: formData.get("unitPrice"),
  });
  const amount = data.qty * data.unitPrice;

  await prisma.$transaction(async (tx) => {
    const item = await tx.invoiceItem.create({
      data: { invoiceId, description: data.description, qty: data.qty, unitPrice: data.unitPrice, amount },
    });
    await tx.invoice.update({ where: { id: invoiceId }, data: { totalAmount: { increment: amount } } });
    await logActivity(
      { userId: session.user.id, action: "ADD_ITEM", entityType: "InvoiceItem", entityId: item.id },
      tx
    );
  });

  revalidatePath(`/billing/${invoiceId}`);
  redirect(`/billing/${invoiceId}`);
}

export async function deleteInvoiceItem(invoiceId: string, itemId: string) {
  const session = await requireAccess("billing", "write");

  const [invoice, item] = await Promise.all([
    prisma.invoice.findUnique({ where: { id: invoiceId } }),
    prisma.invoiceItem.findUnique({ where: { id: itemId } }),
  ]);
  if (!invoice || !item) redirect("/billing");
  if (invoice.status !== "DRAFT") {
    redirect(`/billing/${invoiceId}?error=${encodeURIComponent("แก้ไขรายการได้เฉพาะใบแจ้งหนี้ที่เป็นฉบับร่างเท่านั้น")}`);
  }

  await prisma.$transaction(async (tx) => {
    await tx.invoiceItem.delete({ where: { id: itemId } });
    await logActivity(
      { userId: session.user.id, action: "DELETE_ITEM", entityType: "InvoiceItem", entityId: itemId },
      tx
    );
    await tx.invoice.update({
      where: { id: invoiceId },
      data: { totalAmount: { decrement: item.amount } },
    });
  });

  revalidatePath(`/billing/${invoiceId}`);
  redirect(`/billing/${invoiceId}`);
}

export async function issueInvoice(invoiceId: string) {
  const session = await requireAccess("billing", "write");

  const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId }, include: { items: true } });
  if (!invoice) redirect("/billing");
  if (invoice.status !== "DRAFT") redirect(`/billing/${invoiceId}`);
  if (invoice.items.length === 0) {
    redirect(`/billing/${invoiceId}?error=${encodeURIComponent("ต้องมีรายการอย่างน้อย 1 รายการก่อนออกใบแจ้งหนี้")}`);
  }

  await prisma.$transaction(async (tx) => {
    await tx.invoice.update({ where: { id: invoiceId }, data: { status: "ISSUED", issuedAt: new Date() } });
    await logActivity(
      { userId: session.user.id, action: "ISSUE", entityType: "Invoice", entityId: invoiceId },
      tx
    );
  });

  revalidatePath("/billing");
  revalidatePath(`/billing/${invoiceId}`);
  redirect(`/billing/${invoiceId}`);
}

export async function markInvoicePaid(invoiceId: string) {
  const session = await requireAccess("billing", "write");

  const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
  if (!invoice) redirect("/billing");
  if (invoice.status !== "ISSUED") redirect(`/billing/${invoiceId}`);

  await prisma.$transaction(async (tx) => {
    await tx.invoice.update({ where: { id: invoiceId }, data: { status: "PAID" } });
    await logActivity(
      { userId: session.user.id, action: "PAY", entityType: "Invoice", entityId: invoiceId },
      tx
    );
  });

  revalidatePath("/billing");
  revalidatePath(`/billing/${invoiceId}`);
  redirect(`/billing/${invoiceId}`);
}
