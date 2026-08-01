"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAccess } from "@/lib/require-session";
import { logActivity } from "@/lib/activity-log";
import { orderSchema, shipmentSchema, MAX_ORDER_ITEM_ROWS } from "@/lib/validation";

class InsufficientStockError extends Error {}

function parseOrderFormData(formData: FormData) {
  const items: { productId: FormDataEntryValue; qty: FormDataEntryValue; unitPrice: FormDataEntryValue }[] = [];
  for (let i = 0; i < MAX_ORDER_ITEM_ROWS; i++) {
    const productId = formData.get(`items_${i}_productId`);
    if (!productId) continue;
    items.push({
      productId,
      qty: formData.get(`items_${i}_qty`) ?? "",
      unitPrice: formData.get(`items_${i}_unitPrice`) ?? "",
    });
  }

  return orderSchema.parse({
    merchantId: formData.get("merchantId"),
    channel: formData.get("channel"),
    externalOrderNo: formData.get("externalOrderNo"),
    customerName: formData.get("customerName"),
    customerAddress: formData.get("customerAddress"),
    items,
  });
}

export async function createOrder(formData: FormData) {
  const session = await requireAccess("orders", "write");
  const data = parseOrderFormData(formData);

  const order = await prisma.$transaction(async (tx) => {
    const created = await tx.order.create({
      data: {
        merchantId: data.merchantId,
        channel: data.channel,
        externalOrderNo: data.externalOrderNo || null,
        customerName: data.customerName,
        customerAddress: data.customerAddress,
        items: {
          create: data.items.map((item) => ({
            productId: item.productId,
            qty: item.qty,
            unitPrice: item.unitPrice,
          })),
        },
      },
    });

    await logActivity(
      { userId: session.user.id, action: "CREATE", entityType: "Order", entityId: created.id },
      tx
    );

    return created;
  });

  revalidatePath("/orders");
  redirect(`/orders/${order.id}`);
}

export async function allocateOrder(orderId: string) {
  const session = await requireAccess("orders", "write");

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: { include: { product: true } } },
  });
  if (!order || order.status !== "PENDING") {
    redirect(`/orders/${orderId}`);
  }

  try {
    await prisma.$transaction(async (tx) => {
      const pickList = await tx.pickList.create({
        data: { orderId, status: "PENDING" },
      });

      for (const item of order.items) {
        const candidates = await tx.inventory.findMany({
          where: { productId: item.productId },
          include: { location: true },
          orderBy: { location: { binCode: "asc" } },
        });
        const chosen = candidates.find((inv) => inv.quantity - inv.reservedQty >= item.qty);
        if (!chosen) {
          throw new InsufficientStockError(item.product.name);
        }

        await tx.pickListItem.create({
          data: {
            pickListId: pickList.id,
            orderItemId: item.id,
            locationId: chosen.locationId,
          },
        });

        await tx.inventory.update({
          where: { id: chosen.id },
          data: { reservedQty: { increment: item.qty } },
        });
      }

      await tx.order.update({ where: { id: orderId }, data: { status: "ALLOCATED" } });

      await logActivity(
        { userId: session.user.id, action: "ALLOCATE", entityType: "Order", entityId: orderId },
        tx
      );
    });
  } catch (error) {
    if (error instanceof InsufficientStockError) {
      redirect(
        `/orders/${orderId}?error=${encodeURIComponent(`สต็อกไม่พอสำหรับจัดสรรสินค้า: ${error.message}`)}`
      );
    }
    throw error;
  }

  revalidatePath("/orders");
  revalidatePath(`/orders/${orderId}`);
  redirect(`/orders/${orderId}`);
}

export async function cancelOrder(orderId: string) {
  const session = await requireAccess("orders", "write");

  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order || order.status === "PACKED" || order.status === "SHIPPED" || order.status === "CANCELLED") {
    redirect(`/orders/${orderId}`);
  }

  await prisma.$transaction(async (tx) => {
    if (order.status === "ALLOCATED" || order.status === "PICKING") {
      const pickList = await tx.pickList.findUnique({
        where: { orderId },
        include: { items: { include: { orderItem: true } } },
      });
      if (pickList) {
        for (const item of pickList.items) {
          await tx.inventory.updateMany({
            where: { productId: item.orderItem.productId, locationId: item.locationId },
            data: { reservedQty: { decrement: item.orderItem.qty } },
          });
        }
      }
    }

    await tx.order.update({ where: { id: orderId }, data: { status: "CANCELLED" } });

    await logActivity(
      { userId: session.user.id, action: "CANCEL", entityType: "Order", entityId: orderId },
      tx
    );
  });

  revalidatePath("/orders");
  revalidatePath(`/orders/${orderId}`);
}

export async function shipOrder(orderId: string, formData: FormData) {
  const session = await requireAccess("orders", "write");

  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order || order.status !== "PACKED") {
    redirect(`/orders/${orderId}`);
  }

  const data = shipmentSchema.parse({
    courier: formData.get("courier"),
    trackingNo: formData.get("trackingNo"),
  });

  await prisma.$transaction(async (tx) => {
    await tx.shipment.create({
      data: {
        orderId,
        courier: data.courier,
        trackingNo: data.trackingNo || null,
        status: "SHIPPED",
        shippedAt: new Date(),
      },
    });

    await tx.order.update({ where: { id: orderId }, data: { status: "SHIPPED" } });

    await logActivity(
      { userId: session.user.id, action: "SHIP", entityType: "Order", entityId: orderId },
      tx
    );
  });

  revalidatePath("/orders");
  revalidatePath(`/orders/${orderId}`);
  redirect(`/orders/${orderId}`);
}
