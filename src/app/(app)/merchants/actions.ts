"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAccess } from "@/lib/require-session";
import { logActivity } from "@/lib/activity-log";
import { merchantSchema } from "@/lib/validation";

function parseFormData(formData: FormData) {
  return merchantSchema.parse({
    name: formData.get("name"),
    contactEmail: formData.get("contactEmail"),
    contactPhone: formData.get("contactPhone"),
    billingTerms: formData.get("billingTerms"),
    status: formData.get("status"),
  });
}

export async function createMerchant(formData: FormData) {
  const session = await requireAccess("merchants", "write");
  const data = parseFormData(formData);

  const merchant = await prisma.merchant.create({
    data: {
      name: data.name,
      contactEmail: data.contactEmail,
      contactPhone: data.contactPhone || null,
      billingTerms: data.billingTerms || null,
      status: data.status,
    },
  });

  await logActivity({
    userId: session.user.id,
    action: "CREATE",
    entityType: "Merchant",
    entityId: merchant.id,
  });

  revalidatePath("/merchants");
  redirect(`/merchants/${merchant.id}`);
}

export async function updateMerchant(merchantId: string, formData: FormData) {
  const session = await requireAccess("merchants", "write");
  const data = parseFormData(formData);

  await prisma.merchant.update({
    where: { id: merchantId },
    data: {
      name: data.name,
      contactEmail: data.contactEmail,
      contactPhone: data.contactPhone || null,
      billingTerms: data.billingTerms || null,
      status: data.status,
    },
  });

  await logActivity({
    userId: session.user.id,
    action: "UPDATE",
    entityType: "Merchant",
    entityId: merchantId,
  });

  revalidatePath("/merchants");
  revalidatePath(`/merchants/${merchantId}`);
}
