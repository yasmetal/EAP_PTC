import { z } from "zod";

/**
 * ID ที่อ้างอิงจาก <select> ในฟอร์ม (foreign key) — ใช้ pattern แบบกว้างแทน z.string().uuid()
 * เพราะ z.string().uuid() บังคับ RFC 4122 version/variant nibble ซึ่ง id ตัวอย่างใน seed
 * (เช่น "00000000-...-000000000001") ไม่ผ่าน แม้จะเป็นรูปแบบ UUID ที่ใช้งานได้จริงกับ Postgres
 */
const idField = (message: string) =>
  z.string().regex(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/, message);

export const merchantSchema = z.object({
  name: z.string().trim().min(1, "กรุณากรอกชื่อร้านค้า"),
  contactEmail: z.string().trim().email("อีเมลไม่ถูกต้อง"),
  contactPhone: z.string().trim().optional().or(z.literal("")),
  billingTerms: z.string().trim().optional().or(z.literal("")),
  status: z.enum(["active", "inactive"]),
});

export type MerchantInput = z.infer<typeof merchantSchema>;

export const productSchema = z.object({
  merchantId: idField("กรุณาเลือก Merchant"),
  sku: z.string().trim().min(1, "กรุณากรอก SKU"),
  name: z.string().trim().min(1, "กรุณากรอกชื่อสินค้า"),
  barcode: z.string().trim().optional().or(z.literal("")),
  weightKg: z.coerce.number().positive("น้ำหนักต้องมากกว่า 0").optional().or(z.literal("")),
  category: z.string().trim().optional().or(z.literal("")),
});

export type ProductInput = z.infer<typeof productSchema>;

export const inboundReceiveSchema = z.object({
  productId: idField("กรุณาเลือกสินค้า"),
  locationId: idField("กรุณาเลือกตำแหน่งจัดเก็บ"),
  qty: z.coerce.number().int().positive("จำนวนต้องมากกว่า 0"),
});

export type InboundReceiveInput = z.infer<typeof inboundReceiveSchema>;

export const MAX_ORDER_ITEM_ROWS = 8;

export const orderItemInputSchema = z.object({
  productId: idField("กรุณาเลือกสินค้า"),
  qty: z.coerce.number().int().positive("จำนวนต้องมากกว่า 0"),
  unitPrice: z.coerce.number().nonnegative("ราคาต้องไม่ติดลบ"),
});

export const orderSchema = z.object({
  merchantId: idField("กรุณาเลือก Merchant"),
  channel: z.string().trim().min(1, "กรุณากรอกช่องทางการขาย"),
  externalOrderNo: z.string().trim().optional().or(z.literal("")),
  customerName: z.string().trim().min(1, "กรุณากรอกชื่อลูกค้า"),
  customerAddress: z.string().trim().min(1, "กรุณากรอกที่อยู่จัดส่ง"),
  items: z.array(orderItemInputSchema).min(1, "ต้องมีสินค้าอย่างน้อย 1 รายการ"),
});

export type OrderInput = z.infer<typeof orderSchema>;

export const pickScanSchema = z.object({
  pickListItemId: idField("รหัสรายการไม่ถูกต้อง"),
  qty: z.coerce.number().int().positive("จำนวนต้องมากกว่า 0"),
});

export type PickScanInput = z.infer<typeof pickScanSchema>;

export const shipmentSchema = z.object({
  courier: z.string().trim().min(1, "กรุณากรอกชื่อขนส่ง"),
  trackingNo: z.string().trim().optional().or(z.literal("")),
});

export type ShipmentInput = z.infer<typeof shipmentSchema>;

export const invoiceCreateSchema = z
  .object({
    merchantId: idField("กรุณาเลือก Merchant"),
    periodStart: z.string().min(1, "กรุณาเลือกวันที่เริ่มรอบบิล"),
    periodEnd: z.string().min(1, "กรุณาเลือกวันที่สิ้นสุดรอบบิล"),
  })
  .refine((data) => new Date(data.periodEnd) >= new Date(data.periodStart), {
    message: "วันที่สิ้นสุดต้องไม่ก่อนวันที่เริ่มรอบบิล",
    path: ["periodEnd"],
  });

export type InvoiceCreateInput = z.infer<typeof invoiceCreateSchema>;

export const invoiceItemInputSchema = z.object({
  description: z.string().trim().min(1, "กรุณากรอกรายละเอียด"),
  qty: z.coerce.number().int().positive("จำนวนต้องมากกว่า 0"),
  unitPrice: z.coerce.number().nonnegative("ราคาต้องไม่ติดลบ"),
});

export type InvoiceItemInput = z.infer<typeof invoiceItemInputSchema>;

export const returnCreateSchema = z.object({
  orderId: idField("กรุณาเลือกออเดอร์"),
  reason: z.string().trim().min(1, "กรุณากรอกเหตุผลการคืนสินค้า"),
});

export type ReturnCreateInput = z.infer<typeof returnCreateSchema>;

export const returnItemInputSchema = z.object({
  productId: idField("รหัสสินค้าไม่ถูกต้อง"),
  qty: z.coerce.number().int().positive("จำนวนต้องมากกว่า 0"),
  condition: z.string().trim().min(1, "กรุณาระบุสภาพสินค้า"),
  action: z.enum(["RESTOCK", "DISPOSE"]),
});

export type ReturnItemInput = z.infer<typeof returnItemInputSchema>;

export const userCreateSchema = z.object({
  name: z.string().trim().min(1, "กรุณากรอกชื่อ"),
  email: z.string().trim().email("อีเมลไม่ถูกต้อง"),
  password: z.string().min(8, "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร"),
  roleId: idField("กรุณาเลือกบทบาท"),
  status: z.enum(["active", "inactive"]),
});

export type UserCreateInput = z.infer<typeof userCreateSchema>;

export const userUpdateSchema = z.object({
  name: z.string().trim().min(1, "กรุณากรอกชื่อ"),
  roleId: idField("กรุณาเลือกบทบาท"),
  status: z.enum(["active", "inactive"]),
  password: z.string().trim().min(8, "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร").optional().or(z.literal("")),
});

export type UserUpdateInput = z.infer<typeof userUpdateSchema>;
