"use client";

import { useActionState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { importInboundExcel, type ImportState } from "./actions";

const INITIAL_STATE: ImportState = { status: "idle" };

export function InboundImportForm({ maxRows }: { maxRows: number }) {
  const [state, formAction, pending] = useActionState(importInboundExcel, INITIAL_STATE);

  return (
    <div className="space-y-4">
      <form action={formAction} className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1 space-y-2">
          <Label htmlFor="file">ไฟล์ Excel (.xlsx)</Label>
          <Input
            id="file"
            name="file"
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            required
            disabled={pending}
          />
        </div>
        <div className="flex gap-2">
          <Button type="submit" disabled={pending}>
            {pending ? "กำลังนำเข้า..." : "นำเข้าข้อมูล"}
          </Button>
          <a
            href="/api/inbound/template"
            download
            className={buttonVariants({ variant: "outline" })}
          >
            ดาวน์โหลดไฟล์ตัวอย่าง
          </a>
        </div>
      </form>

      <p className="text-xs text-muted-foreground">
        ไฟล์ตัวอย่างมีชีตอ้างอิงรายชื่อร้านค้าและรหัสตำแหน่งจัดเก็บที่มีอยู่จริงในระบบ · นำเข้าได้สูงสุด{" "}
        {maxRows} แถวต่อไฟล์ · ถ้ามีแถวใดผิด ระบบจะไม่บันทึกทั้งไฟล์
      </p>

      {state.status === "success" && state.summary && (
        <div
          aria-live="polite"
          className="rounded-md border border-green-600/30 bg-green-600/10 px-4 py-3 text-sm text-green-700 dark:text-green-400"
        >
          นำเข้าสำเร็จ {state.summary.rows} แถว — รับเข้ารวม{" "}
          {new Intl.NumberFormat("th-TH").format(state.summary.totalQty)} ชิ้น ใน{" "}
          {state.summary.products} ตำแหน่งจัดเก็บ
        </div>
      )}

      {state.status === "error" && (
        <div
          aria-live="polite"
          className="space-y-2 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          <p>{state.message}</p>
          {state.errors && state.errors.length > 0 && (
            <ul className="max-h-56 list-inside list-disc space-y-1 overflow-y-auto">
              {state.errors.map((e) => (
                <li key={e.rowNumber}>
                  แถวที่ {e.rowNumber}: {e.message}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
