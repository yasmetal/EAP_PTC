import { niceScale, compactNumber } from "@/lib/chart-scale";

export type TrendPoint = {
  /** ป้ายกำกับสั้นบนแกน X เช่น "5 ส.ค." */
  label: string;
  /** ข้อความเต็มที่แสดงตอนชี้เมาส์ */
  tooltip: string;
  value: number;
};

const W = 480;
const H = 200;
// ช่องซ้ายกว้างพอสำหรับป้ายแกน Y ที่ยาวที่สุดที่ compactNumber จะคืนมา ("999พัน" / "1.5ล้าน")
const PAD = { top: 14, right: 48, bottom: 32, left: 52 };
const PLOT_X0 = PAD.left;
const PLOT_X1 = W - PAD.right;
const PLOT_Y0 = PAD.top;
const PLOT_Y1 = H - PAD.bottom;
const PLOT_W = PLOT_X1 - PLOT_X0;
const PLOT_H = PLOT_Y1 - PLOT_Y0;

/**
 * กราฟเส้น + พื้นที่ใต้เส้น สำหรับข้อมูลรายวันชุดเดียว
 * ชุดข้อมูลเดียวจึงไม่ต้องมี legend (หัวเรื่องการ์ดบอกอยู่แล้ว) และกำกับค่าเฉพาะ
 * จุดสุดท้ายกับจุดสูงสุดเท่านั้น ไม่ใส่ตัวเลขทุกจุด
 */
export function TrendChart({
  points,
  color = "var(--chart-1)",
  unit = "",
}: {
  points: TrendPoint[];
  color?: string;
  unit?: string;
}) {
  const maxValue = Math.max(...points.map((p) => p.value), 0);
  const scale = niceScale(maxValue, { tickCount: 4, integer: true });

  const x = (i: number) =>
    points.length === 1 ? PLOT_X0 + PLOT_W / 2 : PLOT_X0 + (i * PLOT_W) / (points.length - 1);
  const y = (v: number) => PLOT_Y1 - (v / scale.max) * PLOT_H;

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(p.value)}`).join(" ");
  const areaPath = `${linePath} L${x(points.length - 1)},${PLOT_Y1} L${x(0)},${PLOT_Y1} Z`;

  const lastIndex = points.length - 1;
  const maxIndex = points.reduce((best, p, i) => (p.value > points[best].value ? i : best), 0);
  // กำกับค่าที่จุดปลายเสมอ และเพิ่มจุดสูงสุดเฉพาะเมื่ออยู่ห่างจากจุดปลายพอที่จะไม่ทับกัน
  const labelled = new Set<number>([lastIndex]);
  if (points[maxIndex].value > 0 && lastIndex - maxIndex >= 2) labelled.add(maxIndex);

  const tickIndexes = points
    .map((_, i) => i)
    .filter((i) => i === lastIndex || (i % 3 === 0 && lastIndex - i >= 2));

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label="กราฟแนวโน้มรายวัน"
      className="h-auto w-full min-w-[360px]"
    >
      {/* เส้นตาราง: เส้นบางทึบ ไม่ใช้เส้นประ และจางกว่าข้อมูลเสมอ */}
      {scale.ticks.map((t) => (
        <g key={t}>
          <line
            x1={PLOT_X0}
            x2={PLOT_X1}
            y1={y(t)}
            y2={y(t)}
            stroke="var(--chart-grid)"
            strokeWidth={1}
          />
          <text
            x={PLOT_X0 - 6}
            y={y(t) + 3.5}
            textAnchor="end"
            fontSize={10}
            className="fill-muted-foreground tabular-nums"
          >
            {compactNumber(t)}
          </text>
        </g>
      ))}

      <path d={areaPath} fill={color} fillOpacity={0.1} />
      <path
        d={linePath}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {/* จุดปลายเส้น มีวงแหวนสีพื้นการ์ดกันจมกับเส้น */}
      {[...labelled].map((i) => (
        <circle
          key={i}
          cx={x(i)}
          cy={y(points[i].value)}
          r={4}
          fill={color}
          strokeWidth={2}
          className="stroke-card"
        />
      ))}

      {[...labelled].map((i) => {
        const anchorEnd = i === lastIndex;
        return (
          <text
            key={`label-${i}`}
            x={anchorEnd ? x(i) + 8 : x(i)}
            y={anchorEnd ? y(points[i].value) + 3.5 : y(points[i].value) - 9}
            textAnchor={anchorEnd ? "start" : "middle"}
            fontSize={11}
            className="fill-foreground font-medium tabular-nums"
          >
            {compactNumber(points[i].value)}
            {unit}
          </text>
        );
      })}

      {/* แกน X */}
      <line
        x1={PLOT_X0}
        x2={PLOT_X1}
        y1={PLOT_Y1}
        y2={PLOT_Y1}
        stroke="var(--chart-axis)"
        strokeWidth={1}
      />
      {tickIndexes.map((i) => (
        <text
          key={`tick-${i}`}
          x={x(i)}
          y={PLOT_Y1 + 15}
          textAnchor={i === 0 ? "start" : i === lastIndex ? "end" : "middle"}
          fontSize={10}
          className="fill-muted-foreground"
        >
          {points[i].label}
        </text>
      ))}

      {/* พื้นที่รับการชี้เมาส์: กว้างเต็มช่วงของแต่ละจุด ไม่ใช่แค่ตัวจุดเล็ก ๆ */}
      {points.map((p, i) => {
        const band = PLOT_W / Math.max(points.length - 1, 1);
        return (
          <rect
            key={`hit-${i}`}
            x={Math.max(PLOT_X0, x(i) - band / 2)}
            y={PLOT_Y0}
            width={Math.min(band, PLOT_W)}
            height={PLOT_H}
            fill="transparent"
          >
            <title>{p.tooltip}</title>
          </rect>
        );
      })}
    </svg>
  );
}
