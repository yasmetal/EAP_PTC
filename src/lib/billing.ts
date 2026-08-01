import type { Prisma } from "@prisma/client";

/** ค่าบริการหยิบ-แพ็คต่อหน่วยสินค้า ใช้คำนวณรายการอัตโนมัติตอนสร้างใบแจ้งหนี้จากออเดอร์ที่จัดส่งแล้ว */
export const FULFILLMENT_FEE_PER_UNIT = 15;

export async function generateInvoiceNo(tx: Prisma.TransactionClient): Promise<string> {
  const now = new Date();
  const datePart = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(
    now.getDate()
  ).padStart(2, "0")}`;
  const prefix = `INV-${datePart}-`;
  const count = await tx.invoice.count({ where: { invoiceNo: { startsWith: prefix } } });
  return `${prefix}${String(count + 1).padStart(3, "0")}`;
}
