import { barPath } from "@/lib/chart-scale";

export type BarItem = {
  label: string;
  value: number;
  /** ค่าที่แสดงเป็นข้อความ (เช่น จัดรูปแบบเป็นเงินบาท) — ถ้าไม่ส่งจะใช้ value */
  display: string;
  tooltip?: string;
};

const W = 480;
const LABEL_W = 148;
const BAR_X0 = 154;
const ROW_H = 30;
const BAR_T = 16;
const PAD_Y = 6;
const LABEL_MAX_CHARS = 22;
/** ที่ว่างท้ายแท่งสำหรับตัวเลขกำกับ — ค่าเงินบาทยาวกว่าจำนวนนับ จึงให้ผู้เรียกกำหนดเองได้ */
const DEFAULT_VALUE_GUTTER = 62;

/**
 * กราฟแท่งแนวนอน ชุดข้อมูลเดียว — ใช้เปรียบเทียบขนาด (ออเดอร์ต่อสถานะ, สินค้าขายดี ฯลฯ)
 *
 * ทุกแท่งใช้สีเดียวกันโดยตั้งใจ: ชื่อสถานะ/ชื่อสินค้าไม่มีลำดับในตัวเอง การไล่สีตามค่า
 * จะเป็นการเข้ารหัสความยาวแท่งซ้ำสองครั้งโดยไม่ได้ข้อมูลเพิ่ม
 * เลือกแนวนอนเพราะชื่อภาษาไทยยาว วางแกนตั้งแล้วป้ายจะซ้อนกัน
 */
export function BarChart({
  items,
  color = "var(--chart-1)",
  valueGutter = DEFAULT_VALUE_GUTTER,
}: {
  items: BarItem[];
  color?: string;
  valueGutter?: number;
}) {
  const max = Math.max(...items.map((i) => i.value), 0);
  const height = items.length * ROW_H + PAD_Y * 2;
  const barMaxWidth = W - valueGutter - BAR_X0;
  const width = (value: number) => (max <= 0 ? 0 : (value / max) * barMaxWidth);

  return (
    <svg
      viewBox={`0 0 ${W} ${height}`}
      role="img"
      aria-label="กราฟแท่งเปรียบเทียบ"
      className="h-auto w-full min-w-[360px]"
    >
      {/* เส้นฐานเดียว — ไม่ต้องมีเส้นตารางเพราะทุกแท่งมีตัวเลขกำกับที่ปลายอยู่แล้ว */}
      <line
        x1={BAR_X0}
        x2={BAR_X0}
        y1={PAD_Y}
        y2={height - PAD_Y}
        stroke="var(--chart-axis)"
        strokeWidth={1}
      />

      {items.map((item, i) => {
        const rowY = PAD_Y + i * ROW_H;
        const barY = rowY + (ROW_H - BAR_T) / 2;
        const w = width(item.value);
        return (
          <g key={`${item.label}-${i}`}>
            <text
              x={LABEL_W}
              y={rowY + ROW_H / 2 + 3.5}
              textAnchor="end"
              fontSize={11}
              className="fill-muted-foreground"
            >
              {truncate(item.label, LABEL_MAX_CHARS)}
            </text>

            {w > 0 && <path d={barPath(BAR_X0, barY, w, BAR_T, "right")} fill={color} />}

            {/* ค่ากำกับวางนอกปลายแท่งเสมอ จึงไม่มีทางถูกแท่งตัดข้อความ */}
            <text
              x={BAR_X0 + w + 6}
              y={rowY + ROW_H / 2 + 3.5}
              fontSize={11}
              className="fill-foreground font-medium tabular-nums"
            >
              {item.display}
            </text>

            <rect
              x={0}
              y={rowY}
              width={W}
              height={ROW_H}
              fill="transparent"
            >
              <title>{item.tooltip ?? `${item.label}: ${item.display}`}</title>
            </rect>
          </g>
        );
      })}
    </svg>
  );
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}
