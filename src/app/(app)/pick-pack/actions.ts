"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAccess } from "@/lib/require-session";
import { logActivity } from "@/lib/activity-log";
import { pickScanSchema } from "@/lib/validation";

async function claimPickList(tx: Prisma.TransactionClient, pickListId: string, userId: string) {
  const pickList = await tx.pickList.findUnique({ where: { id: pickListId } });
  if (!pickList) return;
  if (pickList.status === "PENDING") {
    await tx.pickList.update({
      where: { id: pickListId },
      data: { status: "IN_PROGRESS", assignedTo: pickList.assignedTo ?? userId },
    });
    await tx.order.updateMany({
      where: { id: pickList.orderId, status: "ALLOCATED" },
      data: { status: "PICKING" },
    });
  }
}

export async function scanPickItem(pickListId: string, formData: FormData) {
  const session = await requireAccess("pickpack", "write");
  const code = String(formData.get("code") ?? "").trim();

  if (!code) {
    redirect(`/pick-pack/${pickListId}?scan=empty`);
  }

  const items = await prisma.pickListItem.findMany({
    where: { pickListId },
    include: { orderItem: { include: { product: true } } },
  });

  const target = items.find(
    (it) =>
      (it.orderItem.product.barcode === code || it.orderItem.product.sku === code) &&
      it.pickedQty < it.orderItem.qty
  );

  if (!target) {
    redirect(`/pick-pack/${pickListId}?scan=notfound`);
  }

  await prisma.$transaction(async (tx) => {
    await claimPickList(tx, pickListId, session.user.id);
    await tx.pickListItem.update({
      where: { id: target.id },
      data: { pickedQty: { increment: 1 } },
    });
  });

  revalidatePath(`/pick-pack/${pickListId}`);
  redirect(`/pick-pack/${pickListId}?scan=ok`);
}

export async function setPickedQty(pickListItemId: string, formData: FormData) {
  const session = await requireAccess("pickpack", "write");
  const data = pickScanSchema.parse({
    pickListItemId,
    qty: formData.get("qty"),
  });

  const item = await prisma.pickListItem.findUnique({
    where: { id: data.pickListItemId },
    include: { orderItem: true },
  });
  if (!item) redirect("/pick-pack");

  const qty = Math.min(data.qty, item.orderItem.qty);

  await prisma.$transaction(async (tx) => {
    await claimPickList(tx, item.pickListId, session.user.id);
    await tx.pickListItem.update({ where: { id: item.id }, data: { pickedQty: qty } });
  });

  revalidatePath(`/pick-pack/${item.pickListId}`);
  redirect(`/pick-pack/${item.pickListId}`);
}

export async function completePacking(pickListId: string) {
  const session = await requireAccess("pickpack", "write");

  const pickList = await prisma.pickList.findUnique({
    where: { id: pickListId },
    include: { items: { include: { orderItem: true } }, order: true },
  });
  if (!pickList) redirect("/pick-pack");
  if (pickList.status === "COMPLETED") redirect(`/pick-pack/${pickListId}`);

  const incomplete = pickList.items.some((it) => it.pickedQty < it.orderItem.qty);
  if (incomplete) {
    redirect(`/pick-pack/${pickListId}?error=${encodeURIComponent("ยังหยิบสินค้าไม่ครบทุกรายการ")}`);
  }

  await prisma.$transaction(async (tx) => {
    for (const item of pickList.items) {
      await tx.inventory.updateMany({
        where: { productId: item.orderItem.productId, locationId: item.locationId },
        data: {
          quantity: { decrement: item.pickedQty },
          reservedQty: { decrement: item.pickedQty },
        },
      });
    }

    await tx.pickList.update({ where: { id: pickListId }, data: { status: "COMPLETED" } });
    await tx.order.update({ where: { id: pickList.orderId }, data: { status: "PACKED" } });

    await logActivity(
      {
        userId: session.user.id,
        action: "PACK",
        entityType: "Order",
        entityId: pickList.orderId,
      },
      tx
    );
  });

  revalidatePath("/pick-pack");
  revalidatePath(`/pick-pack/${pickListId}`);
  revalidatePath("/inventory");
  revalidatePath(`/orders/${pickList.orderId}`);
  redirect(`/orders/${pickList.orderId}`);
}
