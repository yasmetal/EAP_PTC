"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAccess } from "@/lib/require-session";
import { logActivity } from "@/lib/activity-log";
import { productSchema } from "@/lib/validation";

function parseFormData(formData: FormData) {
  return productSchema.parse({
    merchantId: formData.get("merchantId"),
    sku: formData.get("sku"),
    name: formData.get("name"),
    barcode: formData.get("barcode"),
    weightKg: formData.get("weightKg") || undefined,
    category: formData.get("category"),
  });
}

export async function createProduct(formData: FormData) {
  const session = await requireAccess("products", "write");
  const data = parseFormData(formData);

  let product;
  try {
    product = await prisma.product.create({
      data: {
        merchantId: data.merchantId,
        sku: data.sku,
        name: data.name,
        barcode: data.barcode || null,
        weightKg: data.weightKg === "" || data.weightKg === undefined ? null : data.weightKg,
        category: data.category || null,
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new Error("SKU นี้มีอยู่แล้วสำหรับ Merchant นี้");
    }
    throw error;
  }

  await logActivity({
    userId: session.user.id,
    action: "CREATE",
    entityType: "Product",
    entityId: product.id,
  });

  revalidatePath("/products");
  redirect(`/products/${product.id}`);
}

export async function updateProduct(productId: string, formData: FormData) {
  const session = await requireAccess("products", "write");
  const data = parseFormData(formData);

  try {
    await prisma.product.update({
      where: { id: productId },
      data: {
        merchantId: data.merchantId,
        sku: data.sku,
        name: data.name,
        barcode: data.barcode || null,
        weightKg: data.weightKg === "" || data.weightKg === undefined ? null : data.weightKg,
        category: data.category || null,
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new Error("SKU นี้มีอยู่แล้วสำหรับ Merchant นี้");
    }
    throw error;
  }

  await logActivity({
    userId: session.user.id,
    action: "UPDATE",
    entityType: "Product",
    entityId: productId,
  });

  revalidatePath("/products");
  revalidatePath(`/products/${productId}`);
}
