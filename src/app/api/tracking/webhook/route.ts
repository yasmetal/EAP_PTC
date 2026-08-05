/**
 * ปลายทางรับ webhook จากไปรษณีย์ไทย (ช่องทาง push — ไม่ต้องรอ cron)
 * ตั้งค่า URL นี้ไว้ในหน้าโปรไฟล์ผู้พัฒนาของไปรษณีย์ไทย พร้อมแนบ secret ตามที่อธิบายด้านล่าง
 *
 * เส้นทางนี้อยู่ใต้ /api จึงไม่ผ่าน proxy ที่บังคับ login (ดู src/proxy.ts) — การยืนยันตัวตน
 * ทั้งหมดจึงต้องทำในไฟล์นี้เอง ถ้าไม่ได้ตั้ง THAILANDPOST_WEBHOOK_SECRET จะปฏิเสธทุกคำขอ
 */

import { NextResponse } from "next/server";
import { parseWebhookPayload } from "@/lib/thailand-post";
import { applyTrackingEvents, findShipmentsByBarcodes } from "@/lib/tracking-sync";

export const dynamic = "force-dynamic";

/** เทียบสตริงแบบใช้เวลาคงที่ กันการเดา secret ทีละตัวอักษรจากเวลาที่ตอบกลับ */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function isAuthorized(request: Request): boolean {
  const secret = process.env.THAILANDPOST_WEBHOOK_SECRET?.trim();
  // ไม่ตั้ง secret = ปิดช่องทางนี้ ไม่ใช่เปิดให้ทุกคน
  if (!secret) return false;

  const header =
    request.headers.get("x-webhook-token") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    null;
  if (header && safeEqual(header.trim(), secret)) return true;

  // สำรองไว้สำหรับกรณีที่หน้าตั้งค่าของไปรษณีย์ไทยกรอกได้แค่ URL ใส่ header เพิ่มไม่ได้
  const token = new URL(request.url).searchParams.get("token");
  return Boolean(token && safeEqual(token.trim(), secret));
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, message: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, message: "invalid json" }, { status: 400 });
  }

  const events = parseWebhookPayload(body);
  if (events.length === 0) {
    // ตอบ 200 เพื่อไม่ให้ไปรษณีย์ไทยส่งซ้ำ — payload ที่อ่านไม่ออกส่งซ้ำอีกกี่ครั้งก็อ่านไม่ออกอยู่ดี
    return NextResponse.json({ ok: true, received: 0, applied: 0 });
  }

  const byBarcode = new Map<string, typeof events>();
  for (const event of events) {
    const group = byBarcode.get(event.barcode);
    if (group) group.push(event);
    else byBarcode.set(event.barcode, [event]);
  }

  const shipments = await findShipmentsByBarcodes([...byBarcode.keys()]);
  let applied = 0;
  let unknown = 0;

  for (const [barcode, barcodeEvents] of byBarcode) {
    const matched = shipments.get(barcode);
    if (!matched || matched.length === 0) {
      unknown += 1;
      continue;
    }
    for (const shipment of matched) {
      const result = await applyTrackingEvents(shipment.id, barcodeEvents, "webhook");
      applied += result.newEvents;
    }
  }

  return NextResponse.json({ ok: true, received: events.length, applied, unknownBarcodes: unknown });
}
