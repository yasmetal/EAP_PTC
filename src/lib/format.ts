/**
 * รูปแบบการแสดงผลวันที่/สกุลเงินของทั้งระบบ: ปี พ.ศ. (Buddhist Era)
 * ฐานข้อมูลยังเก็บเป็น UTC/ISO ตามปกติ — แปลงเฉพาะตอนแสดงผลเท่านั้น
 */

const THAI_DATE_LOCALE = "th-TH-u-ca-buddhist";

export function formatThaiDate(date: Date | string | null | undefined): string {
  if (!date) return "-";
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat(THAI_DATE_LOCALE, {
    day: "numeric",
    month: "short",
    year: "numeric",
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
