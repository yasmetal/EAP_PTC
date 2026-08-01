"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAccess } from "@/lib/require-session";
import { logActivity } from "@/lib/activity-log";
import { returnCreateSchema, returnItemInputSchema } from "@/lib/validation";

export async function createReturn(formData: FormData) {
  const session = await requireAccess("returns", "write");
  const data = returnCreateSchema.parse({
    orderId: formData.get("orderId"),
    reason: formData.get("reason"),
  });

  const order = await prisma.order.findUnique({
    where: { id: data.orderId },
    include: { items: true },
  });
  if (!order || order.status !== "SHIPPED") {
    redirect(`/returns/new?error=${encodeURIComponent("รับคืนได้เฉพาะออเดอร์ที่จัดส่งแล้วเท่านั้น")}`);
  }

  const items: { productId: string; qty: number; condition: string; action: "RESTOCK" | "DISPOSE" }[] = [];
  for (const item of order.items) {
    const qtyRaw = formData.get(`items_${item.id}_qty`);
    if (!qtyRaw || Number(qtyRaw) <= 0) continue;
    items.push(
      returnItemInputSchema.parse({
        productId: item.productId,
        qty: qtyRaw,
        condition: formData.get(`items_${item.id}_condition`),
        action: formData.get(`items_${item.id}_action`),
      })
    );
  }
  if (items.length === 0) {
    redirect(
      `/returns/new?orderId=${data.orderId}&error=${encodeURIComponent("กรุณาระบุจำนวนสินค้าที่รับคืนอย่างน้อย 1 รายการ")}`
    );
  }

  const created = await prisma.$transaction(async (tx) => {
    const ret = await tx.return.create({
      data: {
        orderId: data.orderId,
        reason: data.reason,
        status: "RECEIVED",
        items: { create: items },
      },
    });

    await logActivity(
      { userId: session.user.id, action: "CREATE", entityType: "Return", entityId: ret.id },
      tx
    );

    return ret;
  });

  revalidatePath("/returns");
  redirect(`/returns/${created.id}`);
}

export async function startInspecting(returnId: string) {
  const session = await requireAccess("returns", "write");

  const ret = await prisma.return.findUnique({ where: { id: returnId } });
  if (!ret || ret.status !== "RECEIVED") redirect(`/returns/${returnId}`);

  await prisma.$transaction(async (tx) => {
    await tx.return.update({ where: { id: returnId }, data: { status: "INSPECTING" } });
    await logActivity(
      { userId: session.user.id, action: "INSPECT", entityType: "Return", entityId: returnId },
      tx
    );
  });

  revalidatePath("/returns");
  revalidatePath(`/returns/${returnId}`);
}

export async function resolveReturn(returnId: string, formData: FormData) {
  const session = await requireAccess("returns", "write");

  const ret = await prisma.return.findUnique({
    where: { id: returnId },
    include: { items: true },
  });
  if (!ret || ret.status !== "INSPECTING") redirect(`/returns/${returnId}`);

  const restockItems = ret.items.filter((it) => it.action === "RESTOCK");
  const locationByItem = new Map<string, string>();
  for (const item of restockItems) {
    const locationId = formData.get(`location_${item.id}`);
    if (typeof locationId !== "string" || !locationId) {
      redirect(
        `/returns/${returnId}?error=${encodeURIComponent("กรุณาเลือกตำแหน่งจัดเก็บสำหรับสินค้าที่นำกลับเข้าสต็อกทุกรายการ")}`
      );
    }
    locationByItem.set(item.id, locationId as string);
  }

  await prisma.$transaction(async (tx) => {
    for (const item of restockItems) {
      const locationId = locationByItem.get(item.id)!;
      await tx.inventory.upsert({
        where: { productId_locationId: { productId: item.productId, locationId } },
        update: { quantity: { increment: item.qty } },
        create: { productId: item.productId, locationId, quantity: item.qty },
      });
    }

    await tx.return.update({ where: { id: returnId }, data: { status: "RESOLVED" } });
    await logActivity(
      { userId: session.user.id, action: "RESOLVE", entityType: "Return", entityId: returnId },
      tx
    );
  });

  revalidatePath("/returns");
  revalidatePath(`/returns/${returnId}`);
  revalidatePath("/inventory");
  redirect(`/returns/${returnId}`);
}
