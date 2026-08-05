/**
 * รูปแบบการแสดงผลวันที่/สกุลเงินของทั้งระบบ: ปี พ.ศ. (Buddhist Era)
 * ฐานข้อมูลยังเก็บเป็น UTC/ISO ตามปกติ — แปลงเฉพาะตอนแสดงผลเท่านั้น
 */

const THAI_DATE_LOCALE = "th-TH-u-ca-buddhist";

/**
 * ต้องกำหนดโซนเวลาให้ชัดเจน ไม่ปล่อยให้ใช้ค่าเริ่มต้นของเครื่อง
 * เพราะหน้าเว็บ render ฝั่ง server และ server บน Vercel ตั้งเป็น UTC
 * ถ้าไม่ระบุ วันที่-เวลาทุกจุดในระบบจะเพี้ยนไป 7 ชั่วโมงเมื่อขึ้น production
 */
const THAI_TIME_ZONE = "Asia/Bangkok";

export function formatThaiDate(date: Date | string | null | undefined): string {
  if (!date) return "-";
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat(THAI_DATE_LOCALE, {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: THAI_TIME_ZONE,
  }).format(d);
}

export function formatThaiDateTime(date: Date | string | null | undefined): string {
  if (!date) return "-";
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat(THAI_DATE_LOCALE, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: THAI_TIME_ZONE,
  }).format(d);
}

export function formatBaht(amount: number | string): string {
  const n = typeof amount === "string" ? Number(amount) : amount;
  return new Intl.NumberFormat("th-TH", {
    style: "currency",
    currency: "THB",
    currencyDisplay: "symbol",
  }).format(n);
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat("th-TH").format(n);
}
