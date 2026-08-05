/**
 * งานตามเวลา: ดึงสถานะพัสดุที่ยังไม่ถึงปลายทางจาก API ไปรษณีย์ไทย
 * ตารางเวลาอยู่ใน vercel.json — Vercel จะแนบ `Authorization: Bearer $CRON_SECRET` มาให้เอง
 *
 * เส้นทางนี้อยู่ใต้ /api จึงไม่ผ่าน proxy ที่บังคับ login (ดู src/proxy.ts)
 * ถ้าไม่ได้ตั้ง CRON_SECRET จะปฏิเสธทุกคำขอ เพื่อไม่ให้ใครก็ได้ยิงจนโควตา API หมด
 */

import { NextResponse } from "next/server";
import { isThailandPostConfigured } from "@/lib/thailand-post";
import { findShipmentsToSync, syncShipments } from "@/lib/tracking-sync";

export const dynamic = "force-dynamic";
/** เผื่อเวลาให้ดึงได้หลายชุด แต่ยังอยู่ในเพดานของ Vercel */
export const maxDuration = 60;

/** จำกัดต่อรอบให้จบทันเวลา — พัสดุที่เหลือจะถูกหยิบในรอบถัดไปเพราะเรียงตามตัวที่เช็คนานที่สุดก่อน */
const PER_RUN_LIMIT = 100;

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const header = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  return Boolean(header && safeEqual(header.trim(), secret));
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, message: "unauthorized" }, { status: 401 });
  }
  if (!isThailandPostConfigured()) {
    return NextResponse.json(
      { ok: false, message: "THAILANDPOST_API_KEY is not configured" },
      { status: 503 }
    );
  }

  const candidates = await findShipmentsToSync(PER_RUN_LIMIT);
  if (candidates.length === 0) {
    return NextResponse.json({ ok: true, checked: 0, message: "nothing to track" });
  }

  const summary = await syncShipments(candidates);
  return NextResponse.json({
    ok: summary.error === null,
    checked: summary.checked,
    updated: summary.updated,
    delivered: summary.delivered,
    failed: summary.failed,
    notFound: summary.notFound,
    quota: summary.quota,
    error: summary.error,
  });
}
