import { prisma } from "@/lib/prisma";

const TZ = "Asia/Bangkok";
const DAY_MS = 86_400_000;

/**
 * คอลัมน์เวลาในฐานข้อมูลเป็น TIMESTAMP(3) แบบไม่มี time zone และเก็บค่าเป็น UTC
 * การจัดกลุ่ม "รายวัน" จึงต้องตีความเป็น UTC ก่อนแล้วค่อยแปลงเข้าเขตเวลาไทย
 * ไม่เช่นนั้นออเดอร์ช่วงหัวค่ำจะถูกนับเป็นของวันถัดไป
 */
const dayKeyFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** คืนคีย์วันที่ (YYYY-MM-DD ตามเวลาไทย) ย้อนหลัง N วันจนถึงวันนี้ */
export function recentDayKeys(days: number): string[] {
  const now = Date.now();
  return Array.from({ length: days }, (_, i) =>
    dayKeyFormatter.format(new Date(now - (days - 1 - i) * DAY_MS))
  );
}

/** "2026-08-02" → "2 ส.ค." สำหรับป้ายกำกับแกน X */
export function formatDayKeyShort(dayKey: string): string {
  return new Intl.DateTimeFormat("th-TH", {
    timeZone: "UTC",
    day: "numeric",
    month: "short",
  }).format(new Date(`${dayKey}T00:00:00Z`));
}

/** "2026-08-02" → "2 ส.ค. 2569" สำหรับ tooltip */
export function formatDayKeyLong(dayKey: string): string {
  return new Intl.DateTimeFormat("th-TH-u-ca-buddhist", {
    timeZone: "UTC",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(`${dayKey}T00:00:00Z`));
}

type DayRow = { day: string; count: bigint };

function toMap(rows: DayRow[]): Map<string, number> {
  return new Map(rows.map((r) => [r.day, Number(r.count)]));
}

/** จำนวนออเดอร์ที่สร้างในแต่ละวัน ย้อนหลัง N วัน */
export async function ordersPerDay(days: number): Promise<Map<string, number>> {
  const since = new Date(Date.now() - days * DAY_MS);
  const rows = await prisma.$queryRaw<DayRow[]>`
    SELECT to_char(
             date_trunc('day', ("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE ${TZ}),
             'YYYY-MM-DD'
           ) AS day,
           COUNT(*) AS count
    FROM "Order"
    WHERE "createdAt" >= ${since}
    GROUP BY 1
  `;
  return toMap(rows);
}

/** จำนวนครั้งที่รับสินค้าเข้าคลังในแต่ละวัน ย้อนหลัง N วัน (อ่านจาก activity log) */
export async function inboundReceiptsPerDay(days: number): Promise<Map<string, number>> {
  const since = new Date(Date.now() - days * DAY_MS);
  const rows = await prisma.$queryRaw<DayRow[]>`
    SELECT to_char(
             date_trunc('day', ("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE ${TZ}),
             'YYYY-MM-DD'
           ) AS day,
           COUNT(*) AS count
    FROM "ActivityLog"
    WHERE "action" = 'RECEIVE'
      AND "entityType" = 'Inventory'
      AND "createdAt" >= ${since}
    GROUP BY 1
  `;
  return toMap(rows);
}

/** รวมคีย์วันที่กับผลนับให้ครบทุกวัน (วันที่ไม่มีข้อมูลได้ค่า 0) */
export function toSeries(dayKeys: string[], counts: Map<string, number>, unit: string) {
  return dayKeys.map((key) => {
    const value = counts.get(key) ?? 0;
    const full = formatDayKeyLong(key);
    return {
      label: formatDayKeyShort(key),
      full,
      tooltip: `${full} — ${new Intl.NumberFormat("th-TH").format(value)} ${unit}`,
      value,
    };
  });
}
