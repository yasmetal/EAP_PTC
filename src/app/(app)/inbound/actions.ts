"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAccess } from "@/lib/require-session";
import { logActivity } from "@/lib/activity-log";
import { inboundReceiveSchema } from "@/lib/validation";
import {
  INBOUND_MAX_FILE_BYTES,
  parseInboundWorkbook,
  type ParsedInboundRow,
} from "@/lib/inbound-excel";

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

export type ImportRowError = { rowNumber: number; message: string };

export type ImportState = {
  status: "idle" | "success" | "error";
  message?: string;
  errors?: ImportRowError[];
  summary?: { rows: number; totalQty: number; products: number };
};

const MAX_QTY_PER_ROW = 1_000_000;

/** เทียบชื่อร้านค้า/รหัสตำแหน่งแบบไม่สนตัวพิมพ์และช่องว่างซ้ำ ผู้ใช้พิมพ์เองมักไม่ตรงเป๊ะ */
function normalizeKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * นำเข้ารายการรับสินค้าจากไฟล์ Excel
 *
 * ตรวจทุกแถวให้ครบก่อนแล้วค่อยเขียน — ถ้ามีแถวผิดแม้แถวเดียวจะไม่บันทึกอะไรเลย
 * เพื่อไม่ให้สต็อกเข้าไปครึ่ง ๆ กลาง ๆ แล้วผู้ใช้ไม่รู้ว่าต้องนำเข้าซ้ำแถวไหนบ้าง
 */
export async function importInboundExcel(
  _prevState: ImportState,
  formData: FormData
): Promise<ImportState> {
  const session = await requireAccess("inbound", "write");

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { status: "error", message: "กรุณาเลือกไฟล์ Excel (.xlsx) ก่อนกดนำเข้า" };
  }
  if (file.size > INBOUND_MAX_FILE_BYTES) {
    return {
      status: "error",
      message: `ไฟล์ใหญ่เกิน ${Math.round(INBOUND_MAX_FILE_BYTES / 1024 / 1024)}MB`,
    };
  }
  if (!file.name.toLowerCase().endsWith(".xlsx")) {
    return {
      status: "error",
      message: "รองรับเฉพาะไฟล์ .xlsx — ถ้าเป็น .xls หรือ .csv ให้บันทึกใหม่เป็น .xlsx ก่อน",
    };
  }

  const parsed = await parseInboundWorkbook(await file.arrayBuffer());
  if (!parsed.ok) return { status: "error", message: parsed.error };

  const [merchants, locations] = await Promise.all([
    prisma.merchant.findMany({ select: { id: true, name: true, status: true } }),
    prisma.location.findMany({ select: { id: true, binCode: true } }),
  ]);

  const merchantByName = new Map<string, { id: string; status: string }>();
  const ambiguousMerchantNames = new Set<string>();
  for (const m of merchants) {
    const key = normalizeKey(m.name);
    if (merchantByName.has(key)) ambiguousMerchantNames.add(key);
    else merchantByName.set(key, { id: m.id, status: m.status });
  }
  const locationByBin = new Map(locations.map((l) => [normalizeKey(l.binCode), l.id]));

  // ดึงสินค้าที่เกี่ยวข้องทั้งหมดในคำสั่งเดียว แทนการ query ทีละแถว
  const referencedMerchantIds = [
    ...new Set(
      parsed.rows
        .map((r) => merchantByName.get(normalizeKey(r.merchant))?.id)
        .filter((id): id is string => Boolean(id))
    ),
  ];
  const skus = [...new Set(parsed.rows.map((r) => r.sku).filter(Boolean))];
  const barcodes = [...new Set(parsed.rows.map((r) => r.barcode).filter(Boolean))];

  const products = referencedMerchantIds.length
    ? await prisma.product.findMany({
        where: {
          merchantId: { in: referencedMerchantIds },
          OR: [
            ...(skus.length ? [{ sku: { in: skus } }] : []),
            ...(barcodes.length ? [{ barcode: { in: barcodes } }] : []),
          ],
        },
        select: { id: true, merchantId: true, sku: true, barcode: true },
      })
    : [];

  const productBySku = new Map<string, string>();
  const productByBarcode = new Map<string, string>();
  const ambiguousBarcodes = new Set<string>();
  for (const p of products) {
    productBySku.set(`${p.merchantId}::${normalizeKey(p.sku)}`, p.id);
    if (p.barcode) {
      const key = `${p.merchantId}::${normalizeKey(p.barcode)}`;
      if (productByBarcode.has(key)) ambiguousBarcodes.add(key);
      else productByBarcode.set(key, p.id);
    }
  }

  const errors: ImportRowError[] = [];
  const resolved: { productId: string; locationId: string; qty: number }[] = [];

  for (const row of parsed.rows) {
    const rowErrors = validateRow(row, {
      merchantByName,
      ambiguousMerchantNames,
      locationByBin,
      productBySku,
      productByBarcode,
      ambiguousBarcodes,
    });
    if ("message" in rowErrors) {
      errors.push({ rowNumber: row.rowNumber, message: rowErrors.message });
    } else {
      resolved.push(rowErrors);
    }
  }

  if (errors.length > 0) {
    return {
      status: "error",
      message: `พบข้อผิดพลาด ${errors.length} แถว — ยังไม่มีการบันทึกข้อมูลใด ๆ กรุณาแก้ไฟล์แล้วนำเข้าใหม่`,
      errors: errors.slice(0, 50),
    };
  }

  // รวมแถวที่ชี้ไปยังสินค้า+ตำแหน่งเดียวกันเข้าด้วยกัน มิฉะนั้น ON CONFLICT
  // จะกระทบแถวเดิมซ้ำสองครั้งในคำสั่งเดียวและ Postgres จะปฏิเสธทั้งชุด
  const merged = new Map<string, { productId: string; locationId: string; qty: number }>();
  for (const item of resolved) {
    const key = `${item.productId}::${item.locationId}`;
    const existing = merged.get(key);
    if (existing) existing.qty += item.qty;
    else merged.set(key, { ...item });
  }
  const batch = [...merged.values()];

  await prisma.$transaction(async (tx) => {
    const values = Prisma.join(
      batch.map(
        (b) =>
          Prisma.sql`(gen_random_uuid()::text, ${b.productId}, ${b.locationId}, ${b.qty}, 0)`
      )
    );
    // เพิ่มยอดแบบ atomic ในคำสั่งเดียว ไม่อ่านค่ามาบวกฝั่งแอปเพื่อกัน race กับการรับเข้าพร้อมกัน
    const affected = await tx.$queryRaw<{ id: string }[]>`
      INSERT INTO "Inventory" ("id", "productId", "locationId", "quantity", "reservedQty")
      VALUES ${values}
      ON CONFLICT ("productId", "locationId")
      DO UPDATE SET "quantity" = "Inventory"."quantity" + EXCLUDED."quantity"
      RETURNING "id"
    `;

    await tx.activityLog.createMany({
      data: affected.map((r) => ({
        userId: session.user.id,
        action: "RECEIVE",
        entityType: "Inventory",
        entityId: r.id,
      })),
    });
  });

  revalidatePath("/inbound");
  revalidatePath("/inventory");
  revalidatePath("/dashboard");

  return {
    status: "success",
    message: "นำเข้าข้อมูลสำเร็จ",
    summary: {
      rows: parsed.rows.length,
      totalQty: batch.reduce((sum, b) => sum + b.qty, 0),
      products: batch.length,
    },
  };
}

type Lookups = {
  merchantByName: Map<string, { id: string; status: string }>;
  ambiguousMerchantNames: Set<string>;
  locationByBin: Map<string, string>;
  productBySku: Map<string, string>;
  productByBarcode: Map<string, string>;
  ambiguousBarcodes: Set<string>;
};

function validateRow(
  row: ParsedInboundRow,
  lookups: Lookups
): { productId: string; locationId: string; qty: number } | { message: string } {
  if (!row.merchant) return { message: "ไม่ได้กรอกชื่อร้านค้า" };
  const merchantKey = normalizeKey(row.merchant);
  if (lookups.ambiguousMerchantNames.has(merchantKey)) {
    return { message: `มีร้านค้าชื่อ "${row.merchant}" มากกว่าหนึ่งราย — กรุณาแก้ชื่อในระบบให้ไม่ซ้ำกันก่อน` };
  }
  const merchant = lookups.merchantByName.get(merchantKey);
  if (!merchant) return { message: `ไม่พบร้านค้าชื่อ "${row.merchant}"` };
  if (merchant.status !== "active") {
    return { message: `ร้านค้า "${row.merchant}" ถูกปิดใช้งานอยู่` };
  }

  if (!row.sku && !row.barcode) return { message: "ต้องกรอก SKU หรือบาร์โค้ดอย่างน้อยหนึ่งอย่าง" };
  let productId = row.sku
    ? lookups.productBySku.get(`${merchant.id}::${normalizeKey(row.sku)}`)
    : undefined;
  if (!productId && row.barcode) {
    const barcodeKey = `${merchant.id}::${normalizeKey(row.barcode)}`;
    if (lookups.ambiguousBarcodes.has(barcodeKey)) {
      return { message: `บาร์โค้ด "${row.barcode}" ตรงกับสินค้ามากกว่าหนึ่งรายการของร้านนี้ — กรุณาระบุ SKU` };
    }
    productId = lookups.productByBarcode.get(barcodeKey);
  }
  if (!productId) {
    return {
      message: `ไม่พบสินค้า ${row.sku ? `SKU "${row.sku}"` : `บาร์โค้ด "${row.barcode}"`} ของร้าน "${row.merchant}"`,
    };
  }

  if (!row.binCode) return { message: "ไม่ได้กรอกรหัสตำแหน่งจัดเก็บ" };
  const locationId = lookups.locationByBin.get(normalizeKey(row.binCode));
  if (!locationId) return { message: `ไม่พบตำแหน่งจัดเก็บรหัส "${row.binCode}"` };

  const qty = Number(row.qty);
  if (!row.qty || !Number.isFinite(qty)) return { message: `จำนวน "${row.qty}" ไม่ใช่ตัวเลข` };
  if (!Number.isInteger(qty) || qty <= 0) return { message: "จำนวนต้องเป็นจำนวนเต็มมากกว่า 0" };
  if (qty > MAX_QTY_PER_ROW) return { message: `จำนวนต่อแถวต้องไม่เกิน ${MAX_QTY_PER_ROW}` };

  return { productId, locationId, qty };
}
