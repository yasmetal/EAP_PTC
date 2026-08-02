/**
 * ตัวช่วยคำนวณสเกลแกน Y ให้ได้ "เลขกลม" (0 / 5 / 10 / 15 …) แทนค่าดิบ
 * ใช้ร่วมกันทุกกราฟ เพื่อให้ระยะเส้นตารางและป้ายกำกับสอดคล้องกันทั้งแดชบอร์ด
 */

export type Scale = {
  max: number;
  step: number;
  ticks: number[];
};

export function niceScale(
  maxValue: number,
  { tickCount = 4, integer = false }: { tickCount?: number; integer?: boolean } = {}
): Scale {
  if (!Number.isFinite(maxValue) || maxValue <= 0) {
    const step = 1;
    return { max: tickCount, step, ticks: Array.from({ length: tickCount + 1 }, (_, i) => i) };
  }

  const raw = maxValue / tickCount;
  const exponent = Math.floor(Math.log10(raw));
  const base = 10 ** exponent;
  let step = base * 10;
  for (const factor of [1, 2, 2.5, 5, 10]) {
    if (base * factor >= raw) {
      step = base * factor;
      break;
    }
  }
  if (integer) step = Math.max(1, Math.ceil(step));

  return {
    max: step * tickCount,
    step,
    ticks: Array.from({ length: tickCount + 1 }, (_, i) => Number((i * step).toFixed(6))),
  };
}

/** ย่อตัวเลขให้สั้นลงสำหรับป้ายกำกับบนกราฟ (1,200 → 1.2พัน, 2,500,000 → 2.5ล้าน) */
export function compactNumber(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${trim(value / 1_000_000)}ล้าน`;
  if (abs >= 10_000) return `${trim(value / 1_000)}พัน`;
  return new Intl.NumberFormat("th-TH").format(value);
}

function trim(n: number): string {
  return (Math.round(n * 10) / 10).toString();
}

/**
 * เส้นทาง (path) ของแท่งกราฟที่ปลายด้าน "ค่า" มนรัศมี 4px ส่วนด้านฐานยังเป็นมุมฉาก
 * ตามสเปกกราฟของระบบ — ไม่ใช้ <rect rx> เพราะจะมนทั้งสองด้าน
 */
export function barPath(
  x: number,
  y: number,
  width: number,
  height: number,
  direction: "right" | "up",
  radius = 4
): string {
  if (width <= 0 || height <= 0) return "";
  if (direction === "right") {
    const r = Math.min(radius, width, height / 2);
    return `M${x},${y}H${x + width - r}A${r},${r} 0 0 1 ${x + width},${y + r}V${y + height - r}A${r},${r} 0 0 1 ${x + width - r},${y + height}H${x}Z`;
  }
  const r = Math.min(radius, height, width / 2);
  return `M${x},${y + height}V${y + r}A${r},${r} 0 0 1 ${x + r},${y}H${x + width - r}A${r},${r} 0 0 1 ${x + width},${y + r}V${y + height}Z`;
}
