import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";

/**
 * ตัวเลขสรุปหนึ่งค่า — ใช้แทนกราฟแท่งแท่งเดียว ซึ่งไม่ได้บอกอะไรเพิ่มจากตัวเลข
 * ตัวเลขใหญ่ใช้ figure แบบสัดส่วนปกติ (ไม่ใช่ tabular-nums) เพราะ tabular ทำให้เลขดูโปร่งผิดปกติ
 */
export function StatTile({
  label,
  value,
  hint,
  href,
}: {
  label: string;
  value: string;
  hint?: string;
  href?: string;
}) {
  const body = (
    <Card
      size="sm"
      className={
        href ? "h-full transition-colors hover:bg-accent/50" : "h-full"
      }
    >
      <CardContent className="space-y-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-2xl leading-tight font-semibold">{value}</p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );

  return href ? (
    <Link href={href} className="block">
      {body}
    </Link>
  ) : (
    body
  );
}
