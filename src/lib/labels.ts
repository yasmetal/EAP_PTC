import type {
  OrderStatus,
  PickListStatus,
  ShipmentStatus,
  InvoiceStatus,
  ReturnStatus,
  ReturnAction,
} from "@prisma/client";

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING: "รอดำเนินการ",
  ALLOCATED: "จัดสรรสต็อกแล้ว",
  PICKING: "กำลังหยิบสินค้า",
  PACKED: "แพ็คแล้ว",
  SHIPPED: "จัดส่งแล้ว",
  CANCELLED: "ยกเลิก",
};

export const ORDER_STATUS_BADGE: Record<OrderStatus, "default" | "secondary" | "destructive" | "outline"> = {
  PENDING: "outline",
  ALLOCATED: "secondary",
  PICKING: "secondary",
  PACKED: "default",
  SHIPPED: "default",
  CANCELLED: "destructive",
};

export const PICKLIST_STATUS_LABELS: Record<PickListStatus, string> = {
  PENDING: "รอหยิบ",
  IN_PROGRESS: "กำลังหยิบ",
  COMPLETED: "หยิบครบแล้ว",
};

export const SHIPMENT_STATUS_LABELS: Record<ShipmentStatus, string> = {
  PENDING: "รอจัดส่ง",
  SHIPPED: "จัดส่งแล้ว",
  DELIVERED: "ส่งถึงแล้ว",
  FAILED: "จัดส่งไม่สำเร็จ",
};

export const SHIPMENT_STATUS_BADGE: Record<ShipmentStatus, "default" | "secondary" | "destructive" | "outline"> = {
  PENDING: "outline",
  SHIPPED: "secondary",
  DELIVERED: "default",
  FAILED: "destructive",
};

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  DRAFT: "ฉบับร่าง",
  ISSUED: "ออกใบแจ้งหนี้แล้ว",
  PAID: "ชำระแล้ว",
  OVERDUE: "เกินกำหนดชำระ",
};

export const INVOICE_STATUS_BADGE: Record<InvoiceStatus, "default" | "secondary" | "destructive" | "outline"> = {
  DRAFT: "outline",
  ISSUED: "secondary",
  PAID: "default",
  OVERDUE: "destructive",
};

export const RETURN_STATUS_LABELS: Record<ReturnStatus, string> = {
  RECEIVED: "รับคืนแล้ว",
  INSPECTING: "กำลังตรวจสอบ",
  RESOLVED: "ดำเนินการเสร็จสิ้น",
};

export const RETURN_STATUS_BADGE: Record<ReturnStatus, "default" | "secondary" | "destructive" | "outline"> = {
  RECEIVED: "outline",
  INSPECTING: "secondary",
  RESOLVED: "default",
};

export const RETURN_ACTION_LABELS: Record<ReturnAction, string> = {
  RESTOCK: "นำกลับเข้าสต็อก",
  DISPOSE: "ทำลาย/ตัดสต็อก",
};
