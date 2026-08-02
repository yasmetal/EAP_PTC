import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/**
 * กรอบมาตรฐานของกราฟทุกตัวในระบบ: หัวเรื่อง + ตัวกราฟ + "มุมมองตาราง" ที่พับเก็บไว้
 *
 * มุมมองตารางไม่ใช่ของแถม — เป็นช่องทางอ่านค่าสำรองสำหรับผู้ใช้ที่แยกสีไม่ได้
 * หรือใช้โปรแกรมอ่านหน้าจอ และเป็นเงื่อนไขบังคับของชุดสีกราฟที่เลือกไว้ (ดู globals.css)
 */
export function ChartCard({
  title,
  description,
  children,
  table,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  table?: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="overflow-x-auto">{children}</div>
        {table && (
          <details className="text-sm">
            <summary className="w-fit cursor-pointer text-xs text-muted-foreground underline-offset-4 hover:underline">
              ดูข้อมูลแบบตาราง
            </summary>
            <div className="mt-2 overflow-x-auto rounded-md border">{table}</div>
          </details>
        )}
      </CardContent>
    </Card>
  );
}

export function ChartDataTable({
  columns,
  rows,
}: {
  columns: string[];
  rows: (string | number)[][];
}) {
  return (
    <table className="w-full caption-bottom text-sm">
      <thead className="[&_tr]:border-b">
        <tr>
          {columns.map((c, i) => (
            <th
              key={c}
              className={`h-9 px-3 font-medium text-muted-foreground ${
                i === 0 ? "text-left" : "text-right"
              }`}
            >
              {c}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, ri) => (
          <tr key={ri} className="border-b last:border-0">
            {row.map((cell, ci) => (
              <td
                key={ci}
                className={`px-3 py-2 ${
                  ci === 0 ? "text-left" : "text-right tabular-nums"
                }`}
              >
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function ChartEmpty({ message = "ยังไม่มีข้อมูลในช่วงเวลานี้" }: { message?: string }) {
  return (
    <div className="flex h-40 items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
      {message}
    </div>
  );
}
