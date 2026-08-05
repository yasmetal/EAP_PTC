"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAccess } from "@/lib/require-session";
import { logActivity } from "@/lib/activity-log";
import { formatNumber } from "@/lib/format";
import {
  isThailandPostBarcode,
  isThailandPostConfigured,
  registerWebhookBarcodes,
  ThailandPostError,
} from "@/lib/thailand-post";
import { findShipmentsToSync, syncShipments } from "@/lib/tracking-sync";

export type TrackingActionState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "success"; message: string };

/** จำนวนพัสดุสูงสุดที่ยอมให้ดึงในการกดปุ่มครั้งเดียว กันไม่ให้ request ค้างนานเกินไป */
const BULK_LIMIT = 100;

const NOT_CONFIGURED: TrackingActionState = {
  status: "error",
  message:
    "ยังไม่ได้ตั้งค่า API ไปรษณีย์ไทย (THAILANDPOST_API_KEY) — ยังกดดูสถานะจากลิงก์หน้าเว็บไปรษณีย์ไทยได้ตามปกติ",
};

/** อัปเดตสถานะพัสดุรายชิ้นจากหน้ารายละเอียดออเดอร์ */
export async function refreshShipmentTracking(
  shipmentId: string,
  _prevState: TrackingActionState,
  _formData: FormData
): Promise<TrackingActionState> {
  const session = await requireAccess("orders", "write");

  const shipment = await prisma.shipment.findUnique({
    where: { id: shipmentId },
    select: { id: true, orderId: true, trackingNo: true, courier: true },
  });
  if (!shipment) return { status: "error", message: "ไม่พบรายการจัดส่งนี้" };
  if (!shipment.trackingNo) {
    return { status: "error", message: "รายการนี้ยังไม่มีเลขพัสดุ" };
  }
  if (!isThailandPostBarcode(shipment.trackingNo)) {
    return {
      status: "error",
      message: `เลขพัสดุ "${shipment.trackingNo}" ไม่ใช่รูปแบบของไปรษณีย์ไทย (ต้องเป็นตัวอักษร 2 ตัว + ตัวเลข 9 หลัก + TH เช่น EY145587896TH)`,
    };
  }
  if (!isThailandPostConfigured()) return NOT_CONFIGURED;

  const summary = await syncShipments([shipment]);
  if (summary.error) return { status: "error", message: summary.error };

  await logActivity({
    userId: session.user.id,
    action: "TRACK_REFRESH",
    entityType: "Shipment",
    entityId: shipment.id,
  });

  revalidatePath(`/orders/${shipment.orderId}`);
  revalidatePath("/orders");

  const outcome = summary.outcomes[0];
  if (outcome?.notFound) {
    return {
      status: "success",
      message:
        "ยังไม่พบข้อมูลของเลขพัสดุนี้ในระบบไปรษณีย์ไทย — โดยปกติต้องรอหลังฝากส่งสักระยะจึงจะมีสถานะ",
    };
  }
  return {
    status: "success",
    message: outcome?.newEvents
      ? `อัปเดตแล้ว — มีความเคลื่อนไหวใหม่ ${formatNumber(outcome.newEvents)} รายการ (${outcome.statusText ?? "-"})`
      : `อัปเดตแล้ว — ยังไม่มีความเคลื่อนไหวใหม่ (${outcome?.statusText ?? "-"})`,
  };
}

/** ดึงสถานะพัสดุที่ยังไม่ถึงปลายทางทั้งหมดในครั้งเดียว จากหน้ารายการออเดอร์ */
export async function refreshAllTracking(
  _prevState: TrackingActionState,
  _formData: FormData
): Promise<TrackingActionState> {
  const session = await requireAccess("orders", "write");
  if (!isThailandPostConfigured()) return NOT_CONFIGURED;

  const candidates = await findShipmentsToSync(BULK_LIMIT);
  if (candidates.length === 0) {
    return { status: "success", message: "ไม่มีพัสดุที่ต้องติดตามในขณะนี้" };
  }

  const summary = await syncShipments(candidates);
  if (summary.error) return { status: "error", message: summary.error };

  await logActivity({
    userId: session.user.id,
    action: "TRACK_REFRESH_ALL",
    entityType: "Shipment",
    entityId: `bulk:${summary.checked}`,
  });

  revalidatePath("/orders");
  revalidatePath("/dashboard");

  const parts = [
    `ตรวจสอบ ${formatNumber(summary.checked)} รายการ`,
    `มีความเคลื่อนไหวใหม่ ${formatNumber(summary.updated)}`,
  ];
  if (summary.delivered > 0) parts.push(`ส่งถึงแล้ว ${formatNumber(summary.delivered)}`);
  if (summary.failed > 0) parts.push(`จัดส่งไม่สำเร็จ ${formatNumber(summary.failed)}`);
  if (summary.notFound > 0) parts.push(`ยังไม่มีข้อมูล ${formatNumber(summary.notFound)}`);
  if (summary.quota) {
    parts.push(`ใช้โควตา ${formatNumber(summary.quota.used)}/${formatNumber(summary.quota.limit)}`);
  }

  return { status: "success", message: parts.join(" · ") };
}

/**
 * ลงทะเบียนเลขพัสดุกับ webhook ของไปรษณีย์ไทย เพื่อให้ push สถานะมาเองโดยไม่ต้องรอ cron
 * ต้องตั้งค่า URL ปลายทางไว้ในหน้าโปรไฟล์ผู้พัฒนาของไปรษณีย์ไทยก่อน จึงจะได้รับข้อมูลจริง
 */
export async function registerTrackingWebhook(
  _prevState: TrackingActionState,
  _formData: FormData
): Promise<TrackingActionState> {
  const session = await requireAccess("orders", "write");
  if (!isThailandPostConfigured()) return NOT_CONFIGURED;

  const pending = await prisma.shipment.findMany({
    where: {
      status: { in: ["PENDING", "SHIPPED", "FAILED"] },
      trackingNo: { not: null },
      trackingHookedAt: null,
    },
    select: { id: true, trackingNo: true },
    take: BULK_LIMIT,
  });

  const targets = pending.filter((s) => isThailandPostBarcode(s.trackingNo));
  if (targets.length === 0) {
    return { status: "success", message: "ไม่มีเลขพัสดุใหม่ที่ต้องลงทะเบียน" };
  }

  try {
    await registerWebhookBarcodes(targets.map((s) => s.trackingNo!));
  } catch (error) {
    const message =
      error instanceof ThailandPostError ? error.message : "ลงทะเบียน webhook ไม่สำเร็จ";
    return { status: "error", message };
  }

  await prisma.shipment.updateMany({
    where: { id: { in: targets.map((s) => s.id) } },
    data: { trackingHookedAt: new Date() },
  });

  await logActivity({
    userId: session.user.id,
    action: "TRACK_WEBHOOK_REGISTER",
    entityType: "Shipment",
    entityId: `bulk:${targets.length}`,
  });

  revalidatePath("/orders");
  return {
    status: "success",
    message: `ลงทะเบียนรับแจ้งเตือนอัตโนมัติแล้ว ${formatNumber(targets.length)} เลขพัสดุ`,
  };
}
