/**
 * ตรรกะกลางของการซิงก์สถานะพัสดุ ใช้ร่วมกันทั้ง 3 ช่องทาง
 *   - ผู้ใช้กดปุ่มอัปเดตเอง (server action)
 *   - cron ดึงอัตโนมัติเป็นรอบ (/api/cron/tracking)
 *   - ไปรษณีย์ไทย push เข้ามาเอง (/api/tracking/webhook)
 * ทุกช่องทางลงเอยที่ `applyTrackingEvents` เพื่อให้ผลลัพธ์เหมือนกันไม่ว่าข้อมูลจะมาทางไหน
 */

import type { ShipmentStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  isThailandPostBarcode,
  normalizeBarcode,
  trackBarcodes,
  ThailandPostError,
  type TrackingEventPayload,
} from "@/lib/thailand-post";

/**
 * ไปรษณีย์ไทยไม่ได้เปิดเผยตารางรหัสสถานะทั้งชุดเป็นเอกสารสาธารณะ และรหัสอาจเพิ่มได้ในอนาคต
 * จึงตัดสินสถานะจาก "ข้อความภาษาไทย" ซึ่งคงที่และอ่านออก แทนการผูกกับตัวเลขที่ยืนยันไม่ได้
 * รหัสยังถูกเก็บลงฐานข้อมูลไว้ทุกเหตุการณ์ เผื่อภายหลังต้องการแมปตามรหัสจริง ๆ
 */

/** ต้องเช็คก่อนคำว่าสำเร็จ เพราะ "นำจ่ายไม่สำเร็จ" มีคำว่า "สำเร็จ" อยู่ข้างใน */
const FAILURE_KEYWORDS = [
  "ไม่สำเร็จ",
  "ตีกลับ",
  "ส่งคืน",
  "คืนต้นทาง",
  "ยกเลิก",
  "undeliverable",
  "return to sender",
  "returned",
];

const DELIVERED_KEYWORDS = ["นำจ่ายสำเร็จ", "จ่ายสำเร็จ", "รับสิ่งของแล้ว", "delivered"];

/**
 * แปลงเหตุการณ์ "ล่าสุด" เป็นสถานะภายในของเรา
 * ใช้เหตุการณ์ล่าสุดตัวเดียว ไม่ใช่ทั้งไทม์ไลน์ เพื่อให้สถานะแก้ตัวเองได้
 * เช่น นำจ่ายไม่สำเร็จวันนี้ แล้วนำจ่ายสำเร็จวันถัดไป สถานะจะกลับมาเป็นส่งถึงแล้วเอง
 */
export function classifyEvent(event: TrackingEventPayload): ShipmentStatus {
  const text = `${event.statusText}`.toLowerCase();
  if (FAILURE_KEYWORDS.some((keyword) => text.includes(keyword.toLowerCase()))) return "FAILED";
  if (DELIVERED_KEYWORDS.some((keyword) => text.includes(keyword.toLowerCase()))) return "DELIVERED";
  return "SHIPPED";
}

export type ShipmentSyncOutcome = {
  shipmentId: string;
  trackingNo: string;
  newEvents: number;
  status: ShipmentStatus;
  statusText: string | null;
  /** true เมื่อ API ตอบสำเร็จแต่ไม่มีข้อมูลของเลขนี้ (มักเป็นเลขที่ยังไม่เข้าระบบไปรษณีย์) */
  notFound: boolean;
};

export type SyncSummary = {
  checked: number;
  updated: number;
  delivered: number;
  failed: number;
  notFound: number;
  quota: { used: number; limit: number } | null;
  error: string | null;
  outcomes: ShipmentSyncOutcome[];
};

const EMPTY_SUMMARY: SyncSummary = {
  checked: 0,
  updated: 0,
  delivered: 0,
  failed: 0,
  notFound: 0,
  quota: null,
  error: null,
  outcomes: [],
};

/**
 * บันทึกเหตุการณ์ลงไทม์ไลน์แล้วอัปเดตสถานะสรุปบน Shipment
 * เขียนซ้ำได้โดยไม่เกิดข้อมูลซ้ำ เพราะ TrackingEvent มี unique key (shipmentId, statusCode, eventAt)
 */
export async function applyTrackingEvents(
  shipmentId: string,
  events: TrackingEventPayload[],
  source: "api" | "webhook"
): Promise<{ newEvents: number; status: ShipmentStatus; statusText: string | null }> {
  if (events.length === 0) {
    await prisma.shipment.update({
      where: { id: shipmentId },
      data: { trackingCheckedAt: new Date(), trackingError: null },
    });
    const current = await prisma.shipment.findUnique({
      where: { id: shipmentId },
      select: { status: true, trackingStatusText: true },
    });
    return {
      newEvents: 0,
      status: current?.status ?? "PENDING",
      statusText: current?.trackingStatusText ?? null,
    };
  }

  const latest = events[events.length - 1];
  const status = classifyEvent(latest);

  const inserted = await prisma.trackingEvent.createMany({
    data: events.map((event) => ({
      shipmentId,
      barcode: event.barcode,
      statusCode: event.statusCode,
      statusText: event.statusText,
      location: event.location,
      postcode: event.postcode,
      eventAt: event.eventAt,
      source,
    })),
    skipDuplicates: true,
  });

  await prisma.shipment.update({
    where: { id: shipmentId },
    data: {
      status,
      trackingStatusCode: latest.statusCode,
      trackingStatusText: latest.statusText,
      trackingLocation: latest.location,
      trackingUpdatedAt: latest.eventAt,
      trackingCheckedAt: new Date(),
      trackingError: null,
    },
  });

  return { newEvents: inserted.count, status, statusText: latest.statusText };
}

type SyncCandidate = { id: string; trackingNo: string | null; courier: string };

/** เลขพัสดุที่ซิงก์ได้ต้องมีอยู่จริงและอยู่ในรูปแบบของไปรษณีย์ไทย */
export function isSyncable(shipment: SyncCandidate): boolean {
  return isThailandPostBarcode(shipment.trackingNo);
}

/**
 * ดึงสถานะจาก API แล้วอัปเดตพัสดุตามรายการที่ส่งเข้ามา
 * เรียก API ครั้งเดียวต่อชุด (สูงสุด 100 เลขต่อครั้ง) แทนการยิงทีละพัสดุ
 */
export async function syncShipments(shipments: SyncCandidate[]): Promise<SyncSummary> {
  const syncable = shipments.filter(isSyncable);
  if (syncable.length === 0) return { ...EMPTY_SUMMARY, outcomes: [] };

  // เลขพัสดุเดียวกันอาจถูกใช้กับหลาย shipment (เช่น บันทึกซ้ำ) จึงจับกลุ่มไว้ก่อนยิง API
  const byBarcode = new Map<string, SyncCandidate[]>();
  for (const shipment of syncable) {
    const barcode = normalizeBarcode(shipment.trackingNo!);
    const group = byBarcode.get(barcode);
    if (group) group.push(shipment);
    else byBarcode.set(barcode, [shipment]);
  }

  let result: Awaited<ReturnType<typeof trackBarcodes>>;
  try {
    result = await trackBarcodes([...byBarcode.keys()]);
  } catch (error) {
    const message =
      error instanceof ThailandPostError ? error.message : "ซิงก์สถานะพัสดุไม่สำเร็จ";
    // บันทึก error ไว้กับพัสดุที่พยายามซิงก์ เพื่อให้หน้าจอบอกได้ว่าทำไมข้อมูลไม่ขยับ
    await prisma.shipment.updateMany({
      where: { id: { in: syncable.map((s) => s.id) } },
      data: { trackingCheckedAt: new Date(), trackingError: message.slice(0, 500) },
    });
    return { ...EMPTY_SUMMARY, checked: syncable.length, error: message };
  }

  const summary: SyncSummary = { ...EMPTY_SUMMARY, quota: result.quota, outcomes: [] };

  for (const [barcode, group] of byBarcode) {
    const events = result.events.get(barcode) ?? [];
    for (const shipment of group) {
      summary.checked += 1;
      const applied = await applyTrackingEvents(shipment.id, events, "api");
      const notFound = events.length === 0;
      if (notFound) summary.notFound += 1;
      if (applied.newEvents > 0) summary.updated += 1;
      if (applied.status === "DELIVERED") summary.delivered += 1;
      if (applied.status === "FAILED") summary.failed += 1;
      summary.outcomes.push({
        shipmentId: shipment.id,
        trackingNo: barcode,
        newEvents: applied.newEvents,
        status: applied.status,
        statusText: applied.statusText,
        notFound,
      });
    }
  }

  return summary;
}

/**
 * พัสดุที่ยังต้องติดตามต่อ: ส่งแล้วแต่ยังไม่ถึงปลายทาง
 * เรียงจากตัวที่ไม่ได้เช็คนานที่สุดก่อน เพื่อให้แต่ละรอบ cron กระจายไปทั่วแทนที่จะวนตัวเดิม
 */
export async function findShipmentsToSync(limit: number): Promise<SyncCandidate[]> {
  const rows = await prisma.shipment.findMany({
    where: {
      status: { in: ["PENDING", "SHIPPED", "FAILED"] },
      trackingNo: { not: null },
    },
    select: { id: true, trackingNo: true, courier: true },
    orderBy: [{ trackingCheckedAt: { sort: "asc", nulls: "first" } }],
    take: limit * 3,
  });
  return rows.filter(isSyncable).slice(0, limit);
}

/** ใช้ตอน webhook ส่งข้อมูลมาเป็นเลขพัสดุ ต้องหาว่าเลขนั้นผูกกับ shipment ไหนในระบบ */
export async function findShipmentsByBarcodes(
  barcodes: string[]
): Promise<Map<string, { id: string }[]>> {
  const unique = [...new Set(barcodes.map(normalizeBarcode))];
  if (unique.length === 0) return new Map();

  const rows = await prisma.shipment.findMany({
    where: { trackingNo: { in: unique } },
    select: { id: true, trackingNo: true },
  });

  const map = new Map<string, { id: string }[]>();
  for (const row of rows) {
    if (!row.trackingNo) continue;
    const key = normalizeBarcode(row.trackingNo);
    const group = map.get(key);
    if (group) group.push({ id: row.id });
    else map.set(key, [{ id: row.id }]);
  }
  return map;
}
