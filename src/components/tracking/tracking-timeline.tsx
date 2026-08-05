import { formatThaiDateTime } from "@/lib/format";

export type TimelineEvent = {
  id: string;
  statusText: string;
  statusCode: string;
  location: string | null;
  postcode: string | null;
  eventAt: Date;
  source: string;
};

/**
 * ไทม์ไลน์สถานะพัสดุ เรียงใหม่ → เก่า เพราะสิ่งที่ผู้ใช้อยากรู้ที่สุดคือ "ตอนนี้อยู่ไหน"
 * เหตุการณ์ล่าสุดถูกเน้นด้วยจุดทึบและตัวหนา ส่วนที่เหลือจางลงเพื่อไม่แย่งสายตา
 */
export function TrackingTimeline({ events }: { events: TimelineEvent[] }) {
  if (events.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        ยังไม่มีประวัติสถานะ — กด “อัปเดตสถานะ” เพื่อดึงข้อมูลล่าสุดจากไปรษณีย์ไทย
      </p>
    );
  }

  const ordered = [...events].sort((a, b) => b.eventAt.getTime() - a.eventAt.getTime());

  return (
    <ol className="relative space-y-0">
      {ordered.map((event, index) => {
        const isLatest = index === 0;
        const isLast = index === ordered.length - 1;
        return (
          <li key={event.id} className="relative flex gap-3 pb-4 last:pb-0">
            {/* เส้นแกนตั้งวาดต่อจากจุด ยกเว้นรายการสุดท้ายที่ไม่มีอะไรต่อ */}
            <div className="flex flex-col items-center">
              <span
                aria-hidden
                className={
                  isLatest
                    ? "mt-1 size-2.5 shrink-0 rounded-full bg-foreground"
                    : "mt-1 size-2.5 shrink-0 rounded-full border border-muted-foreground/50 bg-background"
                }
              />
              {!isLast && <span aria-hidden className="mt-1 w-px grow bg-border" />}
            </div>

            <div className="min-w-0 flex-1 pb-1">
              <p className={isLatest ? "text-sm font-medium" : "text-sm"}>{event.statusText}</p>
              <p className="text-xs text-muted-foreground">
                {formatThaiDateTime(event.eventAt)}
                {event.location && <> · {event.location}</>}
                {event.postcode && <> {event.postcode}</>}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
