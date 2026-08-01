"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAccess } from "@/lib/require-session";
import { logActivity } from "@/lib/activity-log";
import { inboundReceiveSchema } from "@/lib/validation";

export async function receiveStock(formData: FormData) {
  const session = await requireAccess("inbound", "write");
  const data = inboundReceiveSchema.parse({
    productId: formData.get("productId"),
    locationId: formData.get("locationId"),
    qty: formData.get("qty"),
  });

  await prisma.$transaction(async (tx) => {
    const inventory = await tx.inventory.upsert({
      where: {
        productId_locationId: { productId: data.productId, locationId: data.locationId },
      },
      update: { quantity: { increment: data.qty } },
      create: {
        productId: data.productId,
        locationId: data.locationId,
        quantity: data.qty,
      },
    });

    await logActivity(
      {
        userId: session.user.id,
        action: "RECEIVE",
        entityType: "Inventory",
        entityId: inventory.id,
      },
      tx
    );
  });

  redirect(`/inbound?received=1`);
}
